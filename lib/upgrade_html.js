/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

var whacko = require('whacko');
var fs = require('fs');
require('string.prototype.endswith');
var upgradeJs = require('./upgrade_js');
var upgradeCss = require('./upgrade_css');
var _ = require('lodash');
var path = require('path');
var PathResolver = require('vulcanize/lib/pathresolver');
var elementMapping = require('./element_mapping');
var escodegen = require('escodegen');
var es6Collections = require('es6-collections');
// jshint -W079
var Set = es6Collections.Set || global.Set;
// jshint +W079

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

  $('template[is=auto-binding]').each(function(_ignored, autoBindTemplate) {
    autoBindTemplate.attribs.is = 'dom-bind';
    upgradeDataBoundTemplate($, autoBindTemplate);
  });

  upgradeGlobalCss($);

  $('polymer-element').each(function(_ignored, polyElem) {
    var elemName = polyElem.attribs.name;

    var domModule = $('<dom-module>');
    domModule.attr('id', elemName);
    domModule.text('\n');

    var templateChildren = $(polyElem).find('template');
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

      // Then move all templates in after
      templateChildren.each(function(_ignored, templateChild) {
        domModule.append('  ');
        domModule.append(templateChild);
        domModule.append('\n');
      });
      upgradeElementCss($, polyElem, domModule, template);
    }


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

    var newDeclarations = [];

    // Unknown attributes are probably intended to be published with
    // hostAttributes
    var hostAttrs = {};
    var knownAttributes = ['name', 'attributes', 'noscript', 'extends', 'id'];
    for (var attr in polyElem.attribs) {
      if (_.contains(knownAttributes, attr)) {
        continue;
      }
      hostAttrs[attr] = polyElem.attribs[attr];
    }


    if ('extends' in polyElem.attribs) {
      newDeclarations.push({
          type: 'Property',
          key: {type: 'Identifier', name: 'extends'},
          value: {type: 'Literal', value: polyElem.attribs.extends}
      });
      if (_.contains(polyElem.attribs.extends, '-')) {
        insertHtmlCommentBefore($, polyElem, [
          'TODO(polyup): Inheriting from other custom ' +
              'elements is not yet supported.',
          'See: https://www.polymer-project.org/1.0/docs/' +
              'migration.html#inheritance'
        ]);
      }
    }

    // Handle noscript
    if ('noscript' in polyElem.attribs) {
      var newScript = $('<script>');
      newScript.text("Polymer('" + elemName + "');");
      $(polyElem).append(newScript);
    }

    upgradeDataBoundTemplate($, template, newDeclarations);

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

  // webcomponents.js -> webcomponents-lite.js
  $('script[src]').each(function(_ignored, scriptElem) {
    if (scriptElem.attribs.src.match(/webcomponents(\.min)?.js/)) {
      scriptElem.attribs.src = scriptElem.attribs.src
          .replace(/webcomponents.js$/, 'webcomponents-lite.js')
          .replace(/webcomponents.min.js$/, 'webcomponents-lite.min.js');

      upgradedScriptElems.add(scriptElem);
    }
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

  // Upgrade official polymer elements using the mappings in element_mapping.js
  recursivelyMatchInsideTemplates($, $('body'), '*').forEach(function(elem) {
    if (!(elem.name in elementMapping)) {
      return;
    }
    var newAttribs = {};
    var attribsToUpgrade = elementMapping[elem.name].attributes || {};
    for (var attr in elem.attribs) {
      var newAttr = attribsToUpgrade[attr] || attr;
      if (typeof(newAttr) != 'string') {
        newAttr = newAttr.string;
      }
      newAttribs[newAttr] = elem.attribs[attr];
    }
    if (elementMapping[elem.name].name) {
      elem.name = elementMapping[elem.name].name;
    }
    elem.attribs = newAttribs;
  });

  // Upgrade imports of official polymer elements
  $('link[rel=import][href]').each(function(_ignored, importElem) {
    var match = importElem.attribs.href.match(/([^\/]+)\/([^\/]+)\.html$/);
    if (!match) {
      return;
    }
    var dirName = match[1];
    var fileName = match[2];
    if (!elementMapping[dirName] || !elementMapping[fileName]) {
      return;
    }
    var newDirname = elementMapping[fileName].dirName ||
        elementMapping[dirName].dirName || elementMapping[fileName].name ||
        dirName;
    var newFilename = elementMapping[fileName].name || fileName;

    importElem.attribs.href =
        importElem.attribs.href.substring(0, match.index) +
        newDirname + '/' +
        newFilename + '.html';
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
      console.warn('Warning: unable to read script source for ' + srcPath);
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
 * Upgrades a template element that performs Polymer data binding from 0.5 to
 * 1.0.
 *
 * @param {jQuery} $ The cheerio jQuery object for the document as a whole.
 * @param {TemplateElement} template The template element to upgrade.
 * @param {?Array<Object>} opt_newDeclarations An array to put new function
 *     declarations into. If not given, then it assumes that we're in an auto-
 *     binding template, and adds HTML comments warning if any expressions
 *     require functionality moved into a computed expression declaration.
 */
function upgradeDataBoundTemplate($, template, opt_newDeclarations) {
  var newDeclarations = opt_newDeclarations;
  // Upgrade <template if>
  var templateIfs = recursivelyMatchInsideTemplates(
      $, $(template), 'template[if]');
  templateIfs.forEach(function(templateIf) {
    var attribs = {is: 'dom-if'};
    for (var key in templateIf.attribs) {
      attribs[key] = templateIf.attribs[key];
    }
    templateIf.attribs = attribs;
  });

  // Upgrade <template repeat>
  var templateRepeats = recursivelyMatchInsideTemplates(
      $, $(template), 'template[repeat]');
  templateRepeats.forEach(function(templateRepeat) {
    upgradeTemplateRepeat($, templateRepeat);
  });

  // Look for expressions in attributes
  // TODO(rictic): simplify the next few sections
  var allNodes = recursivelyMatchInsideTemplates($, $(template), '*');
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
      if (newDeclarations) {
        if (newExpression != expression) {
          node.attribs[attrName] = '{{' + newExpression + '}}';
        }
        if (newDeclaration) {
          newDeclarations.push(newDeclaration);
        }
      } else {
        // We're in an auto-binding template where there's nowhere to put
        // new declarations.
        if (newDeclaration) {
          insertHtmlCommentBefore($, node, [
            'This expression can\'t work in a dom-bind template, as it should',
            'be an anonymous computed property. If you convert it into a',
            'Polymer element then polyup should be able to upgrade it.'
          ]);
        } else if (newExpression != expression) {
          node.attribs[attrName] = '{{' + newExpression + '}}';
        }
      }
    }
  });
  // Look for expressions in text nodes
  var allTextNodes = [];
  if (template) {
    allTextNodes = findAllTextNodes(template);
  }
  allTextNodes.forEach(function(textNode) {
    var matchFullExpression = textNode.data.match(/^\{\{(.+)\}\}$/);
    var matchPartialExpression = textNode.data.match(/\{\{(.+?)\}\}/);
    var expression, computedResult, newExpression, newDeclaration;
    var expressionTextNode;
    if (matchFullExpression) {
      expression = matchFullExpression[1];
      computedResult = upgradeJs.fixupComputedExpression(
          'Expression' + (anonymousComputedCounter++),
          expression);
      newExpression = computedResult[0];
      newDeclaration = computedResult[1];
      expressionTextNode = textNode;
      // if (newExpression != expression) {
      //   textNode.data = '{{' + newExpression + '}}';
      // }
      // if (newDeclaration) {
      //   newDeclarations.push(newDeclaration);
      // }
    } else if (matchPartialExpression) {
      var leadingString = textNode.data.substring(
          0, matchPartialExpression.index);
      expression = matchPartialExpression[1];
      var trailingString = textNode.data.substring(
          matchPartialExpression.index + matchPartialExpression[0].length);
      textNode.data = leadingString;
      var expressionWrappingElement = $('<span>');
      expressionWrappingElement.text(' ');
      expressionTextNode = expressionWrappingElement[0].children[0];
      $(textNode).after(expressionWrappingElement);
      expressionWrappingElement.after(trailingString);

      computedResult = upgradeJs.fixupComputedExpression(
          'Expression' + (anonymousComputedCounter++),
          expression);
      newExpression = computedResult[0];
      newDeclaration = computedResult[1];

    } else {
      return;
    }
    if (newDeclarations) {
        expressionTextNode.data = '{{' + newExpression + '}}';
        if (newDeclaration) {
          newDeclarations.push(newDeclaration);
        }
      } else {
        // We're in an auto-binding template where there's nowhere to put
        // new declarations.
        if (newDeclaration) {
          insertHtmlCommentBefore($, expressionTextNode, [
            'This expression can\'t work in a dom-bind template, as it should',
            'be an anonymous computed property. If you convert it into a',
            'Polymer element then polyup should be able to upgrade it.'
          ]);
          expressionTextNode.data = '{{' + expression + '}}';
        } else {
          expressionTextNode.data = '{{' + newExpression + '}}';
        }
      }
  });

  // <input value={{x}}> -> <input value={{x::input}}>
  var inputElems = recursivelyMatchInsideTemplates(
      $, $(template), 'input, textarea, select');
  inputElems.forEach(function(inputElem) {
    // At this point we're guaranteed that any bound expression is either a
    // function call or a simple property binding. We don't want to match
    // function calls here, so we exclude bindings with parens.
    if (!inputElem.attribs.value) {
      return;
    }
    var match = inputElem.attribs.value.match(/\{\{([^\(]+)\}\}/);
    if (!match) {
      return;
    }
    inputElem.attribs.value = '{{' + match[1] + '::input}}';
  });
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
  if (elem.is('template')) {
    elem[0].children.forEach(function(child) {
      recursivelyMatchInsideTemplates($, $(child), matcher, results);
    });
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
    if (line.charAt(line.length - 1) == ' ') {
      throw new Error('Comment ends with a space?');
    }
    commentText += indent + '    ' + line + '\n';
  });
  commentText += indent + ' -->\n' + indent;
  $(elem).before(commentText);
}

function upgradeGlobalCss($) {
  var cssRules = {};
  $(upgradeCss.needsUpgradeQuerySelector).each(function(_ignored, elemNeedsUpgrade) {
    _.extend(
        cssRules,
        upgradeCss.getCssRulesNeededToUpgrade($(elemNeedsUpgrade)));
  });
  if (!_.isEmpty(cssRules)) {
    var style = $('<style>');
    style.attr('is', 'custom-style');
    style.text(getCssTextGivenRules(cssRules));
    $('head').append('  ');
    $('head').append(style);
    $('head').append('\n');
    addHtmlImport($, 'iron-flex-layout/iron-flex-layout.html');
  }
}

function upgradeElementCss($, polymerElement, domModule, templateElem) {
  var cssRules = upgradeCss.getCssRulesNeededToUpgrade($(polymerElement));
  for (var selector in cssRules) {
    cssRules[':host' + selector] = cssRules[selector];
    delete cssRules[selector];
  }
  var elemsNeedingUpgrade = recursivelyMatchInsideTemplates(
      $, $(templateElem), upgradeCss.needsUpgradeQuerySelector);
  elemsNeedingUpgrade.forEach(function(elemNeedsUpgrade) {
    _.extend(
        cssRules,
        upgradeCss.getCssRulesNeededToUpgrade($(elemNeedsUpgrade))
    );
  });
  if (!_.isEmpty(cssRules)) {
    var style = $('<style>');
    style.text(getCssTextGivenRules(cssRules));
    $(domModule).prepend(style);
    $(domModule).prepend('\n  ');
    addHtmlImport($, 'iron-flex-layout/iron-flex-layout.html');
  }
}

function getCssTextGivenRules(cssRules) {
  var contents = (
      '\n    /* TODO(polyup): For speed, consider reworking these styles ' +
      'with .classes\n' +
      '                     and #ids rather than [attributes].\n' +
      '    */'
  );

  for (var selector in cssRules) {
    contents += '\n    ' + selector + ' ' + cssRules[selector];
  }
  contents += '\n  ';
  return contents;
}

function addHtmlImport($, pathWithinComponents) {
  // Don't add duplicate imports.
  var importExists = false;
  $('link[rel=import][href]').each(function(_ignored, linkElem) {
    if (new RegExp(pathWithinComponents + '$').test(linkElem.attribs.href)) {
      importExists = true;
    }
  });
  if (importExists) {
    return;
  }

  // Look for either webcomponents.js or polymer.html and work out the path to
  // the components directory from there
  var pathToComponents;
  $('link[rel=import][href], script[src]').each(function(_ignored, elem) {
    var path = elem.attribs.href || elem.attribs.src;
    var pathExtractor = /(.*)(polymer\/polymer\.html|webcomponentsjs\/webcomponents(-lite)?(\.min)?\.js)$/;
    var match = path.match(pathExtractor);
    if (match) {
      pathToComponents = match[1];
    }
  });
  var newImport = $('<link>').attr('rel', 'import');
  $('head').append('  ');
  $('head').append(newImport);
  $('head').append('\n');
  if (pathToComponents) {
    newImport.attr('href', pathToComponents + pathWithinComponents);
  } else {
    newImport.attr('href', pathWithinComponents);
    insertHtmlCommentBefore($, newImport[0], [
        'TODO(polyup): unable to infer path to components',
        'directory. This import path is probably incomplete.'
    ]);
  }
}

module.exports = upgradeHtml;
