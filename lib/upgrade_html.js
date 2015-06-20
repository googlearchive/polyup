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


/**
 * Upgrades an HTML file and any referenced scripts from Polymer 0.5 to 1.0.
 * @param {string} filename Path to the html file to upgrade.
 * @return {Object<string, string>} A map from filename to upgraded file
 *     contents. The filenames are all absolute. The contents are UTF-8 strings.
 */
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

    // Look for expressions in attributes
    // TODO(rictic): simplify the next few sections
    var allNodes = recursivelyMatchInsideTemplates($, $(domModule), '*');
    var anonymousComputedCounter = 1;
    allNodes.forEach(function(node) {
      if (!node.attribs) {
        return;
      }
      for (var attrName in node.attribs) {
        var attribValue = node.attribs[attrName];
        var matchFullExpression = attribValue.match(/^\{\{(.+)\}\}$/);
        var matchPartialExpression = attribValue.match(/\{\{(.+?)\}\}/);
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
        } else {
          continue;
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
    });
    // Look for expressions in text nodes
    var allTextNodes = findAllTextNodes(domModule[0]);
    allTextNodes.forEach(function(textNode) {
      var matchFullExpression = textNode.data.match(/^\{\{(.+)\}\}$/);
      var matchPartialExpression = textNode.data.match(/\{\{(.+?)\}\}/);
      var expression, computedResult, newExpression, newDeclaration;
      if (matchFullExpression) {
        expression = matchFullExpression[1];
        computedResult = upgradeJs.fixupComputedExpression(
            'Expression' + (anonymousComputedCounter++),
            expression);
        newExpression = computedResult[0];
        newDeclaration = computedResult[1];
        if (newExpression != expression) {
          textNode.data = '{{' + newExpression + '}}';
        }
        if (newDeclaration) {
          newDeclarations.push(newDeclaration);
        }
      } else if (matchPartialExpression) {
        var leadingString = textNode.data.substring(
            0, matchPartialExpression.index);
        expression = matchPartialExpression[1];
        var trailingString = textNode.data.substring(
            matchPartialExpression.index + matchPartialExpression[0].length);
        textNode.data = leadingString;
        var expressionWrappingElement = $('<span>');
        $(textNode).after(expressionWrappingElement);
        expressionWrappingElement.after(trailingString);

        computedResult = upgradeJs.fixupComputedExpression(
            'Expression' + (anonymousComputedCounter++),
            expression);
        newExpression = computedResult[0];
        newDeclaration = computedResult[1];
        expressionWrappingElement.text('{{' + newExpression + '}}');
        if (newDeclaration) {
          newDeclarations.push(newDeclaration);
        }
      } else {
        return;
      }
    });

    // <input value={{x}}> -> <input value={{x::input}}>
    var inputElems = recursivelyMatchInsideTemplates(
        $, $(domModule), 'input, textarea');
    inputElems.forEach(function(inputElem) {
      // At this point we're guaranteed that any bound expression is either a
      // function call or a simple property binding. We don't want to match
      // function calls here, so we exclude bindings with parens.
      var match = inputElem.attribs.value.match(/\{\{([^\(]+)\}\}/);
      if (!match) {
        return;
      }
      inputElem.attribs.value = '{{' + match[1] + '::input}}';
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

  // Upgrade imports of official polymer elements
  $('link[rel=import][href]').each(function(_ignored, importElem) {
    var match = importElem.attribs.href.match(/([^\/]+)\/([^\/]+)\.html$/);
    if (!match) {
      return;
    }
    var dirname = match[1];
    var filename = match[2];
    if (!elementMapping[dirname] || !elementMapping[filename]) {
      return;
    }
    importElem.attribs.href =
        importElem.attribs.href.substring(0, match.index) +
        elementMapping[dirname].name + '/' +
        elementMapping[filename].name + '.html';
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
  // If there's nothing to do for a file (html or js) then leave it byte for
  //   byte the same.
  // Polymer.import -> Polymer.base.importHref
  // handle mixins
  // Expressions with filters, i.e. {{x | f}}
  // remove curly braces from on-* event handler attributes
  // convert attributes in template from camelCase to dash-case
  // detect layout attributes. Warn? Try to do the right thing?
  // replace polymer-ready with web-components-ready
  // warn on trackstart and trackend events
  // Do we need to convert this.x = y to this._setX(y) for properties?
  // Handle external stylesheets (<link rel=stylesheet>)
  // elem.domMethod -> Polymer.dom(elem).domMethod:
  //   appendChild, insertBefore, removeChild, flush, childNodes, parentNode,
  //   firstChild, lastChild, firstElementChild, lastElementChild,
  //   previousSibling, nextSibling, textContent, innerHTML, querySelector,
  //   querySelectorAll, getDistributedNodes, getDestinationInsertionPoints,
  //   setAttribute, removeAttribute, classList
  // Make a github page for polyup
  // Polyup cli (command line flags, etc)
}

/**
 * Upgrades the given script element in place, or if it's a remote script whose
 * source can be found, returns the pair [absoluteFilename, newSource].
 *
 * Returns undefined if the script's source can't be found, or if the script
 * is inline and has been upgraded in place.
 *
 * @param {jQuery} $ The cheerio jQuery object for the containing document.
 * @param {string} docFilename The absolute path to the containing document.
 * @param {ScriptElement} scriptElem The <script> element to modify.
 * @param {?Object<string, Object>} attrs The attributes of the
 *    <polymer-element> that contains this script, if any.
 * @param {?Object<string, Object>} hostAttrs The hostAttributes of the
 *    <polymer-element> that contains this script, if any.
 * @param {?string} elemName The name of the <polymer-element> that contains
 *    this script, if any.
 * @param {Array<PropertyAst>} A list of new properties to add to the Polymer()
 *    declaration that corresponds to elemName.
 * @return {?Array<string>}
 */
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
        upgradeJs(
            scriptSource, attrs, hostAttrs, elemName, newDeclarations, 0) + '\n'
    ];
  } else {
    var upgradedJs = upgradeJs(
        $(scriptElem).text(), attrs, hostAttrs, elemName, newDeclarations, 1);
    $(scriptElem).text('\n' + upgradedJs + '\n');
  }
}

/**
 * Returns all elements inside of elem that match the css selector given by
 * `matcher`, including those elements contained within <template> elements,
 * or <templates> inside of <templates> and so on.
 *
 * @param {jQuery} $ The cheerio jQuery object for the document as a whole.
 * @param {jQueryElement} elem A jQuery wrapped element to search.
 * @param {string} matcher The css selector to search for.
 * @param {?Array<Element>} results An optional array to append results to.
 * @returns {Array<Element>}
 */
function recursivelyMatchInsideTemplates($, elem, matcher, results) {
  if (results == null) {
    results = [];
  }
  elem.find(matcher).each(function(_ignored, matched) {
    results.push(matched);
  });
  elem.find('template').each(function(_ignored, templateElem) {
    templateElem.children.forEach(function(child) {
      recursivelyMatchInsideTemplates($, $(child), matcher, results);
    });
  });
  return results;
}

/**
 * Returns all text nodes inside of elem or any of its children.
 *
 * @param {Element} elem The HTML Element to search.
 * @param {?Array<TextNode>} results An optional array to append results to.
 * @returns {Array<TextNode>}
 */
function findAllTextNodes(elem, results) {
  if (results == null) {
    results = [];
  }
  elem.children.forEach(function(child) {
    if (child.type === 'text') {
      results.push(child);
    } else if(child.children) {
      findAllTextNodes(child, results);
    }
  });
  return results;
}

/**
 * Upgrades the given <template repeat> element to a dom-repeat.
 *
 * @param {jQuery} $ The cheerio jQuery object for the document.
 * @param {TemplateElement} templateElem The template repeat element to upgrade.
 */
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

/**
 * Inserts HTML comments into the document before the given element.
 *
 * @param {jQuery} $ The cheerio jQuery object for the document.
 * @param {Element} elem The HTML element to precede with comments.
 * @param {Array<string>} commentLines The lines of the comment to insert.
 */
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
