'use strict';

var whacko = require('whacko');
var fs = require('fs');
require('string.prototype.endswith');
var upgradeJs = require('./upgrade_js');
var _ = require('lodash');
var path = require('path');
var PathResolver = require('vulcanize/lib/pathresolver');
var elementMapping = require('./element_mapping');
var escodegen = require('escodegen');

function upgradeHtml(filename) {
  filename = path.resolve(filename);
  var elemSource = fs.readFileSync(filename, 'utf-8');
  var results = {};
  var upgradedScriptElems = new Set();

  var $ = whacko.load(elemSource);

  $('polymer-element').each(function(_ignored, polyElem) {
    var elemName = polyElem.attribs.name;

    // The properties that are listed in the 'attributes' attribute are
    // published by default. The js upgrade will want to know about this.
    var attrs = {};
    if (polyElem.attribs.attributes) {
      polyElem.attribs.attributes.split(/\s+/).forEach(
        function(publishedAttrName) {
          if (!publishedAttrName) {
            return;
          }
          attrs[publishedAttrName] = {
            name: publishedAttrName,
            notify: { type: 'Literal', value: true}
          };
        }
      );
    }

    // Unknown attributes are probably intended to be published with
    // hostAttributes
    var hostAttrs = {};
    var knownAttributes = ['name', 'attributes', 'noscript', 'extends'];
    for (var attr in polyElem.attribs) {
      if (_.contains(knownAttributes, attr)) {
        continue;
      }
      hostAttrs[attr] = polyElem.attribs[attr];
    }

    var domModule = $('<dom-module>');
    domModule.attr('id', elemName);
    domModule.text('\n');

    if ('extends' in polyElem.attribs) {
      domModule.attr('extends', polyElem.attribs.extends);
      if (polyElem.attribs.extends.indexOf('-') != -1) {
        insertHtmlCommentBefore($, polyElem, [
          'TODO(polyup): Inheriting from other custom ' +
              'elements is not yet supported.',
          'See: https://www.polymer-project.org/1.0/docs/' +
              'migration.html#inheritance'
        ]);
      }
    }

    var templateChildren = $(polyElem).find('template');
    if (templateChildren.length > 1) {
      throw new Error(
          'Expected a <polymer-element> to have at most one ' +
          'direct <template> child.');
    }
    var template;
    if (templateChildren[0]) {
      template = templateChildren[0];

      // Migrate styles up to be a direct child of dom-module
      $(template.children[0]).find('style').each(function(_ignored, styleElem) {
        domModule.append('  ');
        var before = styleElem.previousSibling;
        if (before.type === 'text') {
          $(before).remove();
        }
        domModule.append($(styleElem));
        domModule.append('\n');
      });

      // Then move the template in after
      domModule.append('  ');
      domModule.append(template);
      domModule.append('\n');
    }

    // Handle noscript
    if ('noscript' in polyElem.attribs) {
      var newScript = $('<script>');
      newScript.text("Polymer('" + elemName + "');");
      $(polyElem).append(newScript);
    }

    // Upgrade <template if>
    var templateIfs = recursivelyMatchInsideTemplates(
        $, $(domModule), 'template[if]');
    templateIfs.forEach(function(templateIf) {
      var attribs = {is: 'dom-if'};
      for (var key in templateIf.attribs) {
        attribs[key] = templateIf.attribs[key];
      }
      templateIf.attribs = attribs;
    });

    // Upgrade <template repeat>
    var templateRepeats = recursivelyMatchInsideTemplates(
        $, $(domModule), 'template[repeat]');
    templateRepeats.forEach(function(templateRepeat) {
      upgradeTemplateRepeat($, templateRepeat);
    });

    var newDeclarations = [];

    // Look for expressions in templates
    var allNodes = recursivelyMatchInsideTemplates($, $(domModule), '*');
    allNodes.forEach(function(node) {
      if (node.type == 'text') {
        // text node, find and upgrade expressions inside the free text,
        // and wrap them in <span>s where necessary.
      } else if (node.attribs) {
        for (var attrName in node.attribs) {
          var attribValue = node.attribs[attrName];
          var matchFullExpression = attribValue.match(/^\{\{(.+)\}\}$/);
          var matchPartialExpression = attribValue.match(/\{\{.+?\}\}/);
          var expression;
          if (matchFullExpression) {
            expression = matchFullExpression[1];
          } else if (matchPartialExpression) {
            // Ok this is an attribute with at least one {{}} in it.
            // We want to turn attr="a {{b}} c" into:
            // attr="computeAttr(b)"
            // and add a declaration to the polymer element for:
            // computeAttr: function (b) { return "a " + b + " c"; }
            var remaining = attribValue;
            var stringPieces = [];
            var match = remaining.match(/\{\{(.+?)\}\}/);
            while(match) {
              var leadingString = remaining.substring(0, match.index);
              var innerExpression = match[1];
              remaining = remaining.substring(match.index + match[0].length);
              stringPieces.push(escodegen.generate({
                  type: 'Literal', value: leadingString}));
              stringPieces.push('(' + innerExpression + ')');
              match = remaining.match(/\{\{(.+?)\}\}/);
            }
            if (remaining.length > 0) {
              stringPieces.push(escodegen.generate({
                  type: 'Literal', value: remaining}));
            }
            expression = stringPieces.join(' + ');
          }
          var computedResult = upgradeJs.fixupComputedExpression(
                attrName, expression);
          var newExpression = computedResult[0];
          var newDeclaration = computedResult[1];
          if (newExpression != expression) {
            node.attribs[attrName] = '{{' + newExpression + '}}';
          }
          if (newDeclaration) {
            newDeclarations.push(newDeclaration);
          }
        }
      }
    });

    // Upgrade the js
    $('script', polyElem).each(function(_, scriptElem) {
      // Move the script after the polymer-element.
      $(polyElem).after(scriptElem);
      upgradedScriptElems.add(scriptElem);
      var out = upgradeScriptElement(
          $, filename, scriptElem, attrs, hostAttrs, elemName, newDeclarations);
      if (out != null) {
        results[out[0]] = out[1];
      }
    });

    // Replace the <polymer-element> with our shiny new <dom-module>
    $(polyElem).replaceWith(domModule);
    domModule.after('\n');
  });

  // Now upgrade all scripts not directly associated with any particular
  // <polymer-element>
  $('script').each(function(_ignored, scriptElem) {
    if (upgradedScriptElems.has(scriptElem)) {
      return;
    }
    var out = upgradeScriptElement($, filename, scriptElem);
    if (out != null) {
      results[out[0]] = out[1];
    }
  });

  // webcomponents.js -> webcomponents_lite.js
  $('script[src]').each(function(_ignored, scriptElem) {
    scriptElem.attribs.src = scriptElem.attribs.src
        .replace(/webcomponents.js$/, 'webcomponents_lite.js')
        .replace(/webcomponents.min.js$/, 'webcomponents_lite.min.js');
  });

  // Upgrade official polymer elements using the mappings in element_mapping.js
  recursivelyMatchInsideTemplates($, $('body'), '*').forEach(function(elem) {
    if (!(elem.name in elementMapping)) {
      return;
    }
    var newAttribs = {};
    for (var attr in elem.attribs) {
      var newAttr = elementMapping[elem.name].attributes[attr] || attr;
      newAttribs[newAttr] = elem.attribs[attr];
    }
    elem.name = elementMapping[elem.name].name;
    elem.attribs = newAttribs;
  });




  var result = $.html() + '\n';

  // If the source didn't include an <html> or a <body> then we can remove the
  // html boilerplate
  if (!/<html>/.test(elemSource)) {
    result = result.replace(/^<html><head>/, '');
    result = result.replace(/<\/head><body>/, '');
    result = result.replace(/<\/body><\/html>\n/, '');
  }

  results[filename] = result;
  return results;


  // TODOS:
  // finish element_mapping.js
  // job -> debounce
  // resolvePath -> resolveUrl
  // If there's nothing to do for a file (html or js) then leave it byte for
  //   byte the same.
  // <input value='{{value}}'> -> <input value='{{value::input}}'>
  // Polymer.import -> Polymer.base.importHref
  // handle mixins
  // expressions in templates, use FixComputedExpression
  // Expressions with filters, i.e. {{x | f}}
  // remove curly braces from on-* event handler attributes
  // convert attributes in template from camelCase to dash-case
  // detect layout attributes. Warn? Try to do the right thing?
  // replace polymer-ready with web-components-ready
  // warn on trackstart and trackend events
  // Do we need to convert this.x = y to this._setX(y) for properties?
  // elem.domMethod -> Polymer.dom(elem).domMethod:
  //   appendChild, insertBefore, removeChild, flush, childNodes, parentNode,
  //   firstChild, lastChild, firstElementChild, lastElementChild,
  //   previousSibling, nextSibling, textContent, innerHTML, querySelector,
  //   querySelectorAll, getDistributedNodes, getDestinationInsertionPoints,
  //   setAttribute, removeAttribute, classList
  // Make a github page for polyup
  // Polyup cli (command line flags, etc)
}

function upgradeScriptElement($, docFilename, scriptElem, attrs, hostAttrs,
                              elemName, newDeclarations) {
  if ('src' in scriptElem.attribs) {
    var srcPath = scriptElem.attribs.src;
    if (PathResolver.prototype.isAbsoluteUrl(srcPath)) {
      return;
    }
    var pathToScriptElem = path.resolve(path.dirname(docFilename), srcPath);
    var scriptSource;
    try {
      scriptSource = fs.readFileSync(pathToScriptElem, 'utf-8');
    } catch(e) {
      console.warn(
          'Unable to read script source for ' + srcPath);
      console.warn('Error:', e);
      return;
    }
    return [
        pathToScriptElem,
        upgradeJs(scriptSource, attrs, hostAttrs, elemName, newDeclarations, 0) + '\n'
    ];
  } else {
    var upgradedJs = upgradeJs(
        $(scriptElem).text(), attrs, hostAttrs, elemName, newDeclarations, 1);
    $(scriptElem).text('\n' + upgradedJs + '\n');
  }
}

function recursivelyMatchInsideTemplates($, elem, matcher) {
  var results = [];
  elem.find(matcher).each(function(_ignored, matched) {
    results.push(matched);
  });
  elem.find('template').each(function(_ignored, templateElem) {
    templateElem.children.forEach(function(child) {
      results = results.concat(
          recursivelyMatchInsideTemplates($, $(child), matcher));
    });
  });
  return results;
}


function upgradeTemplateRepeat($, templateElem) {
  var attribs = {is: 'dom-repeat'};
  var repeatExpression = templateElem.attribs.repeat;

  var indexAs, itemAs, items;
  var match = repeatExpression.match(
      /\s*{{\s*(.*?)\s*,\s*(.*?)\s+in\s+(.*)\s*}}\s*/);
  if (match) {
    itemAs = match[1];
    indexAs = match[2];
    items = match[3];
  } else {
    match = repeatExpression.match(/\s*{{\s*(.*?)\s+in\s+(.*?)\s*}}\s*/);
    if (match) {
      itemAs = match[1];
      items = match[2];
    } else {
      match = repeatExpression.match(/\s*{{\s*(.*?)\s*}}\s*/);
      if (match) {
        items = match[1];
      } else {
        console.error(
            'Unable to parse template repeat expression: ',
            repeatExpression);
      }
    }
  }
  if (items != null) {
    attribs.items = "{{" + items + "}}";
  }
  if (itemAs != null) {
    attribs.as = itemAs;
  }
  if (indexAs != null) {
    attribs['index-as'] = indexAs;
  }
  if (items != null && itemAs == null && indexAs == null) {
    insertHtmlCommentBefore($, templateElem, [
       'TODO(polyup): convert bindings inside this dom-repeat ' +
            'instance below',
       'from {{foo}} to {{item.foo}}'
    ]);
  }
  delete templateElem.attribs.repeat;
  for (var key in templateElem.attribs) {
    attribs[key] = templateElem.attribs[key];
  }
  templateElem.attribs = attribs;
}

function insertHtmlCommentBefore($, elem, commentLines) {
  var indent = '';
  if (elem.previousSibling && elem.previousSibling.type == 'text') {
    var previousText = elem.previousSibling.data;
    var match = previousText.match(/\n*( +)\n*/);
    if (match) {
      indent = match[1];
    }
  }
  var commentText = '<!--\n';
  commentLines.forEach(function(line) {
    commentText += indent + '    ' + line + '\n';
  });
  commentText += indent + ' -->\n' + indent;
  $(elem).before(commentText);
}

module.exports = upgradeHtml;
