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

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _whacko = require('whacko');

var _whacko2 = _interopRequireDefault(_whacko);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

require('string.prototype.endswith');

var _upgrade_js = require('./upgrade_js');

var _upgrade_js2 = _interopRequireDefault(_upgrade_js);

var _upgrade_css = require('./upgrade_css');

var _upgrade_css2 = _interopRequireDefault(_upgrade_css);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _vulcanizeLibPathresolver = require('vulcanize/lib/pathresolver');

var _vulcanizeLibPathresolver2 = _interopRequireDefault(_vulcanizeLibPathresolver);

var _element_mapping = require('./element_mapping');

var _element_mapping2 = _interopRequireDefault(_element_mapping);

var _escodegen = require('escodegen');

var _escodegen2 = _interopRequireDefault(_escodegen);

var _es6Collections = require('es6-collections');

// jshint -W079

var _es6Collections2 = _interopRequireDefault(_es6Collections);

var Set = _es6Collections2['default'].Set || global.Set;
var Map = _es6Collections2['default'].Map || global.Map;
// jshint +W079

var Page = (function () {
  function Page(filename) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Page);

    this.filename = _path2['default'].resolve(filename);
    this.toIgnore = options.toIgnore || new Set();
    this.modified = false;
    this.results = {};
    this.upgradedScriptElems = new Set();
  }

  /**
   * Upgrades an HTML file and any referenced scripts from Polymer 0.5 to 1.0.
   * @param {string} filename Path to the html file to upgrade.
   * @return {Object<string, string>} A map from filename to upgraded file
   *     contents. The filenames are all absolute. The contents are UTF-8 strings.
   */

  /** The main function */

  _createClass(Page, [{
    key: 'upgrade',
    value: function upgrade() {
      var _this = this;

      var elemSource = _fs2['default'].readFileSync(this.filename, 'utf-8');
      this.$ = _whacko2['default'].load(elemSource);

      this.upgradeGlobalCss();

      this.$('template[is=auto-binding]').each(function (_ignored, autoBindTemplate) {
        autoBindTemplate.attribs.is = 'dom-bind';
        _this.upgradeDataBoundTemplate(autoBindTemplate);
        _this.modified = true;
      });

      this.$('polymer-element').each(function (_ignored, polyElem) {
        _this.modified = true;
        var elemName = polyElem.attribs.name;

        var domModule = _this.$('<dom-module>');
        domModule.attr('id', elemName);
        domModule.text('\n');

        var templateChildren = _this.$(polyElem).find('template');
        var template;
        if (templateChildren[0]) {
          template = templateChildren[0];

          // Migrate styles up to be a direct child of dom-module
          _this.$(template.children[0]).find('style').each(function (_ignored, styleElem) {
            domModule.append('  ');
            var before = styleElem.previousSibling;
            if (before.type === 'text') {
              _this.$(before).remove();
            }
            domModule.append(_this.$(styleElem));
            domModule.append('\n');
          });

          // Then move all templates in after
          templateChildren.each(function (_ignored, templateChild) {
            domModule.append('  ');
            domModule.append(templateChild);
            domModule.append('\n');
          });
          _this.upgradeElementCss(polyElem, domModule, template);
        }

        // The properties that are listed in the 'attributes' attribute are
        // published by default. The js upgrade will want to know about this.
        var attrs = {};
        if (polyElem.attribs.attributes) {
          polyElem.attribs.attributes.split(/\s+/).forEach(function (publishedAttrName) {
            if (!publishedAttrName) {
              return;
            }
            attrs[publishedAttrName] = {
              name: publishedAttrName,
              notify: { type: 'Literal', value: true }
            };
          });
        }

        var newDeclarations = [];

        // Unknown attributes are probably intended to be published with
        // hostAttributes
        var hostAttrs = {};
        var knownAttributes = ['name', 'attributes', 'noscript', 'extends', 'id'];
        for (var attr in polyElem.attribs) {
          if (_lodash2['default'].contains(knownAttributes, attr)) {
            continue;
          }
          hostAttrs[attr] = polyElem.attribs[attr];
        }

        if ('extends' in polyElem.attribs) {
          newDeclarations.push({
            type: 'Property',
            key: { type: 'Identifier', name: 'extends' },
            value: { type: 'Literal', value: polyElem.attribs['extends'] }
          });
          if (_lodash2['default'].contains(polyElem.attribs['extends'], '-')) {
            _this.insertHtmlCommentBefore(polyElem, ['TODO(polyup): Inheriting from other custom ' + 'elements is not yet supported.', 'See: https://www.polymer-project.org/1.0/docs/' + 'migration.html#inheritance']);
          }
        }

        // Handle noscript
        if ('noscript' in polyElem.attribs) {
          var newScript = _this.$('<script>');
          newScript.text("Polymer('" + elemName + "');");
          _this.$(polyElem).append(newScript);
        }

        _this.upgradeDataBoundTemplate(template, newDeclarations);

        // Upgrade the js
        _this.$('script', polyElem).each(function (_ignored, scriptElem) {
          // Move the script after the polymer-element.
          _this.$(polyElem).after(scriptElem);
          _this.upgradedScriptElems.add(scriptElem);
          _this.upgradeScriptElement(scriptElem, attrs, hostAttrs, elemName, newDeclarations);
        });

        // Replace the <polymer-element> with our shiny new <dom-module>
        _this.$(polyElem).replaceWith(domModule);
        domModule.after('\n');
      });

      // webcomponents.js -> webcomponents-lite.js
      this.$('script[src]').each(function (_ignored, scriptElem) {
        if (scriptElem.attribs.src.match(/webcomponents(\.min)?.js/)) {
          scriptElem.attribs.src = scriptElem.attribs.src.replace(/webcomponents.js$/, 'webcomponents-lite.js').replace(/webcomponents.min.js$/, 'webcomponents-lite.min.js');

          _this.upgradedScriptElems.add(scriptElem);
        }
      });

      // Now upgrade all scripts not directly associated with any particular
      // <polymer-element>
      this.$('script').each(function (_ignored, scriptElem) {
        if (_this.upgradedScriptElems.has(scriptElem)) {
          return;
        }
        _this.upgradeScriptElement(scriptElem);
      });

      // Upgrade official polymer elements using the mappings in element_mapping.js
      this.recursivelyMatchInsideTemplates(this.$('body'), '*').forEach(function (elem) {
        if (!(elem.name in _element_mapping2['default'])) {
          return;
        }
        _this.modified = true;
        var newAttribs = {};
        var attribsToUpgrade = _element_mapping2['default'][elem.name].attributes || {};
        for (var attr in elem.attribs) {
          var newAttr = attribsToUpgrade[attr] || attr;
          if (typeof newAttr != 'string') {
            newAttr = newAttr.string;
          }
          newAttribs[newAttr] = elem.attribs[attr];
        }
        if (_element_mapping2['default'][elem.name].name) {
          elem.name = _element_mapping2['default'][elem.name].name;
        }
        elem.attribs = newAttribs;
      });

      // Upgrade imports of official polymer elements
      this.$('link[rel=import][href]').each(function (_ignored, importElem) {
        var match = importElem.attribs.href.match(/([^\/]+)\/([^\/]+)\.html$/);
        if (!match) {
          return;
        }
        _this.modified = true;
        var dirName = match[1];
        var fileName = match[2];
        if (!_element_mapping2['default'][dirName] || !_element_mapping2['default'][fileName]) {
          return;
        }
        var newDirname = _element_mapping2['default'][fileName].dirName || _element_mapping2['default'][dirName].dirName || _element_mapping2['default'][fileName].name || dirName;
        var newFilename = _element_mapping2['default'][fileName].name || fileName;

        importElem.attribs.href = importElem.attribs.href.substring(0, match.index) + newDirname + '/' + newFilename + '.html';
      });

      var result = this.$.html() + '\n';

      // If the source didn't include an <html> or a <body> then we can remove the
      // html boilerplate
      if (!/<html>/.test(elemSource)) {
        result = result.replace(/^<html><head>/, '');
        result = result.replace(/<\/head><body>/, '');
        result = result.replace(/<\/body><\/html>\n/, '');
      }
      if (this.modified) {
        this.results[this.filename] = result;
      }

      return this.results;
    }
  }, {
    key: 'upgradeGlobalCss',
    value: function upgradeGlobalCss() {
      var _this2 = this;

      var cssRules = {};
      this.$(_upgrade_css2['default'].needsUpgradeQuerySelector).each(function (_ignored, elemNeedsUpgrade) {
        _lodash2['default'].extend(cssRules, _upgrade_css2['default'].getCssRulesNeededToUpgrade(_this2.$(elemNeedsUpgrade)));
      });
      if (!_lodash2['default'].isEmpty(cssRules)) {
        var style = this.$('<style>');
        style.attr('is', 'custom-style');
        style.text(getCssTextGivenRules(cssRules));
        this.$('head').append('  ');
        this.$('head').append(style);
        this.$('head').append('\n');
        this.addHtmlImport('iron-flex-layout/iron-flex-layout.html');
      }
    }
  }, {
    key: 'upgradeElementCss',
    value: function upgradeElementCss(polymerElement, domModule, templateElem) {
      var _this3 = this;

      var cssRules = _upgrade_css2['default'].getCssRulesNeededToUpgrade(this.$(polymerElement));
      for (var selector in cssRules) {
        cssRules[':host' + selector] = cssRules[selector];
        delete cssRules[selector];
      }
      var elemsNeedingUpgrade = this.recursivelyMatchInsideTemplates(templateElem, _upgrade_css2['default'].needsUpgradeQuerySelector);
      elemsNeedingUpgrade.forEach(function (elemNeedsUpgrade) {
        _lodash2['default'].extend(cssRules, _upgrade_css2['default'].getCssRulesNeededToUpgrade(_this3.$(elemNeedsUpgrade)));
      });
      if (!_lodash2['default'].isEmpty(cssRules)) {
        var style = this.$('<style>');
        style.text(getCssTextGivenRules(cssRules));
        this.$(domModule).prepend(style);
        this.$(domModule).prepend('\n  ');
        this.addHtmlImport('iron-flex-layout/iron-flex-layout.html');
      }
    }

    /**
     * Upgrades a template element that performs Polymer data binding from 0.5 to
     * 1.0.
     *
     * @param {TemplateElement} template The template element to upgrade.
     * @param {?Array<Object>} opt_newDeclarations An array to put new function
     *     declarations into. If not given, then it assumes that we're in an auto-
     *     binding template, and adds HTML comments warning if any expressions
     *     require functionality moved into a computed expression declaration.
     */
  }, {
    key: 'upgradeDataBoundTemplate',
    value: function upgradeDataBoundTemplate(template, opt_newDeclarations) {
      var _this4 = this;

      var newDeclarations = opt_newDeclarations;
      // Upgrade <template if>
      var templateIfs = this.recursivelyMatchInsideTemplates(template, 'template[if]');
      templateIfs.forEach(function (templateIf) {
        var attribs = { is: 'dom-if' };
        for (var key in templateIf.attribs) {
          attribs[key] = templateIf.attribs[key];
        }
        templateIf.attribs = attribs;
      });

      // Upgrade <template repeat>
      var templateRepeats = this.recursivelyMatchInsideTemplates(template, 'template[repeat]');
      templateRepeats.forEach(function (templateRepeat) {
        _this4.upgradeTemplateRepeat(templateRepeat);
      });

      // Look for expressions in attributes
      // TODO(rictic): simplify the next few sections
      var allNodes = this.recursivelyMatchInsideTemplates(template, '*');
      var anonymousComputedCounter = 1;
      allNodes.forEach(function (node) {
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
            while (match) {
              var leadingString = remaining.substring(0, match.index);
              var innerExpression = match[1];
              remaining = remaining.substring(match.index + match[0].length);
              stringPieces.push(_escodegen2['default'].generate({
                type: 'Literal', value: leadingString }));
              stringPieces.push('(' + innerExpression + ')');
              match = remaining.match(/\{\{(.+?)\}\}/);
            }
            if (remaining.length > 0) {
              stringPieces.push(_escodegen2['default'].generate({
                type: 'Literal', value: remaining }));
            }
            expression = stringPieces.join(' + ');
          } else {
            continue;
          }
          var computedResult = _upgrade_js2['default'].fixupComputedExpression(attrName, expression);
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
              _this4.insertHtmlCommentBefore(node, ['This expression can\'t work in a dom-bind template, as it should', 'be an anonymous computed property. If you convert it into a', 'Polymer element then polyup should be able to upgrade it.']);
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
      for (var i = 0; i < allTextNodes.length; i++) {
        var textNode = allTextNodes[i];

        var matchFullExpression = textNode.data.match(/^\{\{(.+?)\}\}/);
        var matchPartialExpression = textNode.data.match(/\{\{(.+?)\}\}/);
        var expression, computedResult, newExpression, newDeclaration;
        var expressionTextNode;
        if (matchFullExpression && matchFullExpression[0] === textNode.data) {
          expression = matchFullExpression[1];
          computedResult = _upgrade_js2['default'].fixupComputedExpression('Expression' + anonymousComputedCounter++, expression);
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
            var leadingString = textNode.data.substring(0, matchPartialExpression.index);
            expression = matchPartialExpression[1];
            var trailingString = textNode.data.substring(matchPartialExpression.index + matchPartialExpression[0].length);
            textNode.data = leadingString;
            var expressionWrappingElement = this.$('<span>');
            expressionWrappingElement.text(' ');
            expressionTextNode = expressionWrappingElement[0].children[0];
            this.$(textNode).after(expressionWrappingElement);
            if (trailingString.length > 0) {
              expressionWrappingElement.after(trailingString);
              allTextNodes.push(expressionWrappingElement[0].nextSibling);
            }

            computedResult = _upgrade_js2['default'].fixupComputedExpression('Expression' + anonymousComputedCounter++, expression);
            newExpression = computedResult[0];
            newDeclaration = computedResult[1];
          } else {
            continue;
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
            this.insertHtmlCommentBefore(expressionTextNode, ['This expression can\'t work in a dom-bind template, as it should', 'be an anonymous computed property. If you convert it into a', 'Polymer element then polyup should be able to upgrade it.']);
            expressionTextNode.data = '{{' + expression + '}}';
          } else {
            expressionTextNode.data = '{{' + newExpression + '}}';
          }
        }
      }

      // <input value={{x}}> -> <input value={{x::input}}>
      var inputElems = this.recursivelyMatchInsideTemplates(template, 'input, textarea, select');
      inputElems.forEach(function (inputElem) {
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
     * Upgrades the given script element in place, or if it's a remote script whose
     * source can be found, returns the pair [absoluteFilename, newSource].
     *
     * Returns undefined if the script's source can't be found, or if the script
     * is inline and has been upgraded in place.
     *
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
  }, {
    key: 'upgradeScriptElement',
    value: function upgradeScriptElement(scriptElem, attrs, hostAttrs, elemName, newDeclarations) {
      // TODO(rictic): we should be tracking element metadata across the entire
      //     page, then upgrade all javascript, passing in all of the metadata in.
      //     This will solve a bug with multiple calls to Polymer() in not getting
      //     element metadata populated properly.
      var elements = new Map();
      if (elemName) {
        elements.set(elemName, {
          attrs: attrs,
          hostAttrs: hostAttrs,
          newDeclarations: newDeclarations
        });
      }

      if ('src' in scriptElem.attribs) {
        var srcPath = scriptElem.attribs.src;
        if (_vulcanizeLibPathresolver2['default'].prototype.isAbsoluteUrl(srcPath)) {
          return;
        }
        var pathToScriptElem = _path2['default'].resolve(_path2['default'].dirname(this.filename), srcPath);
        if (this.toIgnore.has(pathToScriptElem)) {
          return;
        }
        var scriptSource = undefined;
        try {
          scriptSource = _fs2['default'].readFileSync(pathToScriptElem, 'utf-8');
        } catch (e) {
          console.warn('Warning: unable to read script source for ' + srcPath);
          return;
        }
        var upgradedJs = (0, _upgrade_js2['default'])(scriptSource, elements, elemName, 0);
        if (upgradedJs) {
          this.results[pathToScriptElem] = upgradedJs + '\n';
        }
      } else {
        var upgradedJs = (0, _upgrade_js2['default'])(this.$(scriptElem).text(), elements, elemName, 1);
        if (upgradedJs) {
          this.modified = true;
          this.$(scriptElem).text('\n' + upgradedJs + '\n');
        }
      }
    }

    /**
     * Returns all elements inside of elem that match the css selector given by
     * `matcher`, including those elements contained within <template> elements,
     * or <templates> inside of <templates> and so on.
     *
     * @param {jQueryElement|Element} elem A jQuery wrapped element to search.
     * @param {string} matcher The css selector to search for.
     * @param {?Array<Element>} results An optional array to append results to.
     * @returns {Array<Element>}
     */
  }, {
    key: 'recursivelyMatchInsideTemplates',
    value: function recursivelyMatchInsideTemplates(elem, matcher, results) {
      var _this5 = this;

      elem = this.$(elem);
      if (results == null) {
        results = [];
      }
      if (elem.is('template')) {
        elem[0].children.forEach(function (child) {
          _this5.recursivelyMatchInsideTemplates(child, matcher, results);
        });
      }
      elem.find(matcher).each(function (_ignored, matched) {
        results.push(matched);
      });
      elem.find('template').each(function (_ignored, templateElem) {
        templateElem.children.forEach(function (child) {
          _this5.recursivelyMatchInsideTemplates(child, matcher, results);
        });
      });
      return results;
    }

    /**
     * Upgrades the given <template repeat> element to a dom-repeat.
     *
     * @param {TemplateElement} templateElem The template repeat element to upgrade.
     */
  }, {
    key: 'upgradeTemplateRepeat',
    value: function upgradeTemplateRepeat(templateElem) {
      var attribs = { is: 'dom-repeat' };
      var repeatExpression = templateElem.attribs.repeat;

      var indexAs, itemAs, items;
      var match = repeatExpression.match(/\s*{{\s*(.*?)\s*,\s*(.*?)\s+in\s+(.*)\s*}}\s*/);
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
            console.error('Unable to parse template repeat expression: ', repeatExpression);
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
        this.insertHtmlCommentBefore(templateElem, ['TODO(polyup): convert bindings inside this dom-repeat ' + 'instance below', 'from {{foo}} to {{item.foo}}']);
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
     * @param {Element} elem The HTML element to precede with comments.
     * @param {Array<string>} commentLines The lines of the comment to insert.
     */
  }, {
    key: 'insertHtmlCommentBefore',
    value: function insertHtmlCommentBefore(elem, commentLines) {
      var indent = '';
      if (elem.previousSibling && elem.previousSibling.type == 'text') {
        var previousText = elem.previousSibling.data;
        var match = previousText.match(/\n*( +)\n*/);
        if (match) {
          indent = match[1];
        }
      }
      var commentText = '<!--\n';
      commentLines.forEach(function (line) {
        if (line.charAt(line.length - 1) == ' ') {
          throw new Error('Comment ends with a space?');
        }
        commentText += indent + '    ' + line + '\n';
      });
      commentText += indent + ' -->\n' + indent;
      this.$(elem).before(commentText);
    }
  }, {
    key: 'addHtmlImport',
    value: function addHtmlImport(pathWithinComponents) {
      // Don't add duplicate imports.
      var importExists = false;
      this.$('link[rel=import][href]').each(function (_ignored, linkElem) {
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
      this.$('link[rel=import][href], script[src]').each(function (_ignored, elem) {
        var path = elem.attribs.href || elem.attribs.src;
        var pathExtractor = /(.*)(polymer\/polymer\.html|webcomponentsjs\/webcomponents(-lite)?(\.min)?\.js)$/;
        var match = path.match(pathExtractor);
        if (match) {
          pathToComponents = match[1];
        }
      });
      var newImport = this.$('<link>').attr('rel', 'import');
      this.$('head').append('  ');
      this.$('head').append(newImport);
      this.$('head').append('\n');
      if (pathToComponents) {
        newImport.attr('href', pathToComponents + pathWithinComponents);
      } else {
        newImport.attr('href', pathWithinComponents);
        this.insertHtmlCommentBefore(newImport[0], ['TODO(polyup): unable to infer path to components', 'directory. This import path is probably incomplete.']);
      }
    }
  }]);

  return Page;
})();

function upgradeHtml(filename, options) {
  var page = new Page(filename, options);
  return page.upgrade();
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
  elem.children.forEach(function (child) {
    if (child.type === 'text') {
      results.push(child);
    } else if (child.children) {
      findAllTextNodes(child, results);
    }
  });
  return results;
}

function getCssTextGivenRules(cssRules) {
  var contents = '\n    /* TODO(polyup): For speed, consider reworking these styles ' + 'with .classes\n' + '                     and #ids rather than [attributes].\n' + '    */';

  for (var selector in cssRules) {
    contents += '\n    ' + selector + ' ' + cssRules[selector];
  }
  contents += '\n  ';
  return contents;
}

module.exports = upgradeHtml;
