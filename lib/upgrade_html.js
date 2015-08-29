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

require("babel/polyfill");
import whacko from 'whacko';
import fs from 'fs';
import 'string.prototype.endswith';
import upgradeJs from './upgrade_js';
import upgradeCss from './upgrade_css';
import _ from 'lodash';
import path from 'path';
import PathResolver from 'vulcanize/lib/pathresolver';
import elementMapping from './element_mapping';
import escodegen from 'escodegen';
import espree from 'espree';

class Page {
  constructor(filename, options={}) {
    this.filename = path.resolve(filename);
    this.toIgnore = options.toIgnore || new Set();
    this.webserverRoot = options.webserverRoot;
    this.componentsPath = options.componentsPath;
    this.onlyReformat = options.onlyReformat;
    this.modified = false;
    this.results = {};
    this.upgradedScriptElems = new Set();
    this.elements = new Map();
    this.scriptElementsToCustomElements = new Map();
  }

  /** The main function */
  upgrade() {
    var elemSource = fs.readFileSync(this.filename, 'utf-8');
    this.$ = whacko.load(elemSource);

    this.upgradeGlobalCss();

    this.$('template[is=auto-binding]').each((_ignored, autoBindTemplate) => {
      autoBindTemplate.attribs.is = 'dom-bind';
      this.upgradeDataBoundTemplate(autoBindTemplate);
      this.modified = true;
    });

    this.$('polymer-element').each((_ignored, polyElem) => {
      this.modified = true;
      var elemName = polyElem.attribs.name;
      var elementMetadata = {
        name: elemName,
        attrs: {},
        hostAttrs: {},
        listeners: {},
        newDeclarations: new Set(),
        polyfillTokenList: false
      };
      this.elements.set(elemName, elementMetadata);

      var domModule = this.$('<dom-module>');
      domModule.attr('id', elemName);
      domModule.text('\n');

      for (let child of polyElem.children) {
        if (child.type === 'comment') {
          // Move comment children of the polymer element up one level.
          this.$(polyElem).before(child).before('\n');
        }
      }

      var templateChildren = this.$(polyElem).find('template');
      var template;
      if (templateChildren[0]) {
        template = templateChildren[0];

        // Migrate styles up to be a direct child of dom-module
        let styleElements = this.$(template.children[0]).find(
            'style, link[rel=stylesheet][href]');
        styleElements.each((_ignored, styleElem) => {
          domModule.append('  ');
          var before = styleElem.previousSibling;
          if (before.type === 'text') {
            this.$(before).remove();
          }
          domModule.append(this.$(styleElem));
          domModule.append('\n');
        });
        domModule.find('link[rel=stylesheet][href]').each(
          (_ignored, styleImport) => {
            let href = styleImport.attribs.href;
            delete styleImport.attribs.href;
            styleImport.attribs.rel = 'import';
            styleImport.attribs.type = 'css';
            styleImport.attribs.href = href;
          }
        );

        // Then move all templates in after
        templateChildren.each((_ignored, templateChild) => {
          domModule.append('  ');
          domModule.append(templateChild);
          domModule.append('\n');
        });
        this.upgradeElementCss(polyElem, domModule, template);
      }


      // The properties that are listed in the 'attributes' attribute are
      // published by default. The js upgrade will want to know about this.
      elementMetadata.attrs = {};
      if (polyElem.attribs.attributes) {
        polyElem.attribs.attributes.split(/\s+/).forEach(
          (publishedAttrName) => {
            if (!publishedAttrName) {
              return;
            }
            elementMetadata.attrs[publishedAttrName] = {
              name: publishedAttrName,
              notify: { type: 'Literal', value: true}
            };
          }
        );
      }

      // Unknown attributes are either listeners, or they're probably intended
      // to be published with hostAttributes.
      var knownAttributes = ['name', 'attributes', 'noscript', 'extends', 'id'];
      for (var attr in polyElem.attribs) {
        if (_.contains(knownAttributes, attr)) {
          continue;
        }
        var match = attr.match(/^on-(.*)$/);
        if (match) {
          var eventName = match[1];
          var listenerFuncExpr = polyElem.attribs[attr];
          match = listenerFuncExpr.match(/^(\{\{|\[\[)(.*)(\}\}|\]\])$/);
          if (match) {
            listenerFuncExpr = match[2];
          }
          elementMetadata.listeners[eventName] = listenerFuncExpr;
        } else {
          elementMetadata.hostAttrs[attr] = polyElem.attribs[attr];
        }
      }


      if ('extends' in polyElem.attribs) {
        elementMetadata.newDeclarations.add({
            type: 'Property',
            key: {type: 'Identifier', name: 'extends'},
            value: {type: 'Literal', value: polyElem.attribs.extends}
        });
        if (_.contains(polyElem.attribs.extends, '-')) {
          this.insertHtmlCommentBefore(polyElem, [
            'TODO(polyup): Inheriting from other custom ' +
                'elements is not yet supported.',
            'See: https://www.polymer-project.org/1.0/docs/' +
                'migration.html#inheritance'
          ]);
        }
      }

      // Handle noscript
      if ('noscript' in polyElem.attribs) {
        var newScript = this.$('<script>');
        newScript.text(`Polymer('${elemName}');`);
        this.$(polyElem).append(newScript);
      }

      this.upgradeDataBoundTemplate(template, elementMetadata);

      // Upgrade the js
      this.$('script', polyElem).each((_ignored, scriptElem) => {
        this.scriptElementsToCustomElements.set(scriptElem, elemName);
        // Move the script after the polymer-element.
        domModule.append('  ');
        domModule.append(scriptElem);
        domModule.append('\n');
      });

      // Replace the <polymer-element> with our shiny new <dom-module>
      this.$(polyElem).replaceWith(domModule);
    });

    // webcomponents.js -> webcomponents-lite.js
    this.$('script[src]').each((_ignored, scriptElem) => {
      if (scriptElem.attribs.src.match(/webcomponents(\.min)?.js/)) {
        scriptElem.attribs.src = scriptElem.attribs.src
            .replace(/webcomponents.js$/, 'webcomponents-lite.js')
            .replace(/webcomponents.min.js$/, 'webcomponents-lite.min.js');

        this.upgradedScriptElems.add(scriptElem);
      }
    });

    // Now upgrade all scripts not directly associated with any particular
    // <polymer-element>
    this.$('script').each((_ignored, scriptElem) => {
      if (this.upgradedScriptElems.has(scriptElem)) {
        return;
      }
      this.upgradeScriptElement(
          scriptElem, this.scriptElementsToCustomElements.get(scriptElem));
    });

    // Upgrade official polymer elements using the mappings in element_mapping.js
    this.recursivelyMatchInsideTemplates(this.$('body'), '*').forEach((elem) => {
      if (!(elem.name in elementMapping)) {
        return;
      }
      this.modified = true;
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
    this.$('link[rel=import][href]').each((_ignored, importElem) => {
      var match = importElem.attribs.href.match(/([^\/]+)\/([^\/]+)\.html$/);
      if (!match) {
        return;
      }
      this.modified = true;
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

    if (!this.modified) {
      return this.results;
    }

    if (this.onlyReformat) {
      this.$ = whacko.load(elemSource);
    }
    var result = `${this.$.html()}\n`;

    // If the source didn't include an <html> or a <body> then we can remove the
    // html boilerplate
    if (!/<html>/.test(elemSource)) {
      result = result.replace(/^<html><head>/, '');
      result = result.replace(/<\/head><body>/, '');
      result = result.replace(/<\/body><\/html>\n/, '');
    }
    this.results[this.filename] = result;

    return this.results;
  }


  upgradeGlobalCss() {
    var cssRules = {};
    this.$(upgradeCss.needsUpgradeQuerySelector).each((_ignored, elemNeedsUpgrade) => {
      _.extend(
          cssRules,
          upgradeCss.getCssRulesNeededToUpgrade(this.$(elemNeedsUpgrade)));
    });
    if (!_.isEmpty(cssRules)) {
      var style = this.$('<style>');
      style.attr('is', 'custom-style');
      style.text(getCssTextGivenRules(cssRules));
      this.$('head').append('  ');
      this.$('head').append(style);
      this.$('head').append('\n');
      this.addHtmlImport('iron-flex-layout/iron-flex-layout.html');
    }
  }

  upgradeElementCss(polymerElement, domModule, templateElem) {
    var cssRules = upgradeCss.getCssRulesNeededToUpgrade(this.$(polymerElement));
    for (var selector in cssRules) {
      cssRules[':host' + selector] = cssRules[selector];
      delete cssRules[selector];
    }
    var elemsNeedingUpgrade = this.recursivelyMatchInsideTemplates(
        templateElem, upgradeCss.needsUpgradeQuerySelector);
    elemsNeedingUpgrade.forEach((elemNeedsUpgrade) => {
      _.extend(
          cssRules,
          upgradeCss.getCssRulesNeededToUpgrade(this.$(elemNeedsUpgrade))
      );
    });
    if (!_.isEmpty(cssRules)) {
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
   * @param {?Array<Object>} elementMetadata The metadata we're tracking for
   *     the associated element for this template, if any.
   */
  upgradeDataBoundTemplate(template, elementMetadata) {
    // Upgrade <template if>
    var templateIfs = this.recursivelyMatchInsideTemplates(
        template, 'template[if]');
    templateIfs.forEach((templateIf) => {
      var attribs = {is: 'dom-if'};
      for (var key in templateIf.attribs) {
        attribs[key] = templateIf.attribs[key];
      }
      templateIf.attribs = attribs;
    });

    // Upgrade <template repeat>
    var templateRepeats = this.recursivelyMatchInsideTemplates(
        template, 'template[repeat]');
    templateRepeats.forEach((templateRepeat) => {
      this.upgradeTemplateRepeat(templateRepeat);
    });

    let addNewDeclaration = (declaration, expression, node) => {
      if (!declaration) {
        return;
      }
      if (elementMetadata) {
        elementMetadata.newDeclarations.add(declaration);
      } else {
        this.insertHtmlCommentBefore(node, [
          `The expression   ${expression}   can't work in a`,
          'dom-bind template, as it should be an anonymous computed property.',
          'If you convert it into a Polymer element then polyup should be ' +
          'able to',
          'upgrade it.'
        ]);
      }
    };

    // Look for expressions in attributes
    var allNodes = this.recursivelyMatchInsideTemplates(template, '*');
    var counter = 1;
    allNodes.forEach((node) => {
      if (!node.attribs) {
        return;
      }
      for (var attrName in node.attribs) {
        let attribValue = node.attribs[attrName];
        // Handle event handler attributes specially.
        if (attrName.match(/^on-/)) {
          let match = attribValue.match(/^\{\{(.*)\}\}$/);
          if (match) {
            node.attribs[attrName] = match[1];
          }
          // Otherwise don't mess with event handler attributes.
          continue;
        }
        let pieces = this.matchExpressions(attribValue);
        //  Empty string. Nothing to do.
        if (pieces.length === 0) {
          continue;
        }
        //  No expressions found. Nothing to do.
        if (pieces.length === 1 && ('string' in pieces[0])) {
          continue;
        }
        // Join the expressions and their in-between string bits into a single
        // string concat expression.
        const expressions = [];
        for (let piece of pieces) {
          if ('string' in piece) {
            expressions.push(escodegen.generate({
                type: 'Literal', value: piece.string}));
          } else {
            expressions.push(piece.expression);
          }
        }
        const shouldOneWayBind = pieces.length === 1 && pieces[0].isOneTime;
        let expression = expressions.join(' + ');
        if (elementMetadata && expression.match(/tokenList/)) {
          elementMetadata.polyfillTokenList = true;
        }

        if (shouldConvertToAttributeBinding(attrName, node)) {
          let tempVal = node.attribs[attrName];
          delete node.attribs[attrName];
          attrName = attrName.replace(/\?$/, '');
          attrName += '$';
          node.attribs[attrName] = tempVal;
        }

        const [namer, newDeclaration] = upgradeJs.fixupComputedExpression(
              expression);
        addNewDeclaration(newDeclaration, expression, node);
        if (elementMetadata && newDeclaration) {
          const renameFn = (newName) => {
            const newExpression = namer(newName);
            let expr = `{{${newExpression}}}`;
            if (shouldOneWayBind) {
              expr = `[[${newExpression}]]`;
            }
            node.attribs[attrName] = expr;
          };
          newDeclaration.onRenameHandlers.push(renameFn);
          let computedFunctionName = '_compute' +
              attrName.charAt(0).toUpperCase() + attrName.substring(1);
          computedFunctionName = computedFunctionName.replace(
              '$', '').replace('?', '');
          newDeclaration.rename(computedFunctionName);
        } else {
          let expr = `{{${expression}}}`;
          if (shouldOneWayBind) {
            expr = `[[${expression}]]`;
          }
          node.attribs[attrName] = expr;
        }
      }
    });

    // Look for expressions in text nodes
    let allTextNodes = [];
    if (template) {
      allTextNodes = findAllTextNodes(template);
    }
    const upgradeExpressionPiece = (piece, textNode, onRename) => {
      if (elementMetadata && piece.expression.match(/tokenList/)) {
        elementMetadata.polyfillTokenList = true;
      }
      const [namer, newDeclaration] =
          upgradeJs.fixupComputedExpression(piece.expression);
      const renameFn = (newName) => {
        const newExpression = namer(newName);
        if (elementMetadata) {
          piece.expression = newExpression;
        }
        onRename();
      };
      const initialName = '_computeExpression' + (counter++);
      if (newDeclaration) {
        newDeclaration.onRenameHandlers.push(renameFn);
        newDeclaration.rename(initialName);
        addNewDeclaration(
            newDeclaration, piece.expression, textNode.parent);
      } else {
        onRename();
      }
    };
    for (let textNode of allTextNodes) {
      let pieces = this.matchExpressions(textNode.data);
      // No expressions. Nothing to do;
      if (pieces.length === 1 && ('string' in pieces[0])) {
        continue;
      }

      // Expression takes up entire text node.
      if (pieces.length === 1 && ('expression' in pieces[0])) {
        upgradeExpressionPiece(pieces[0], textNode, () => {
          textNode.data = `{{${pieces[0].expression}}}`;
        });
        continue;
      }
      for (let piece of pieces) {
        if ('expression' in piece) {
          let span = this.$('<span>');
          this.$(textNode).before(span);
          upgradeExpressionPiece(piece, textNode, () => {
            span.text(`{{${piece.expression}}}`);
          });
        } else {
          this.$(textNode).before(piece.string);
        }
      }

      textNode.data = '';
    }


    // <input value={{x}}> -> <input value={{x::input}}>
    var inputElems = this.recursivelyMatchInsideTemplates(
        template, 'input, textarea, select');
    inputElems.forEach((inputElem) => {
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

  matchExpressions(str) {
    function matchFirstExpression(str) {
      let match = str.match(/\[\[(.+?)\]\]/);
      const isOneTime = !!match;
      if (!match) {
        match = str.match(/\{\{(.+?)\}\}/);
      }
      if (!match) {
        return null;
      }
      let expressionPieces = match[1].split(/\s+\|\s+/);
      let expression = expressionPieces[0];
      for (let func of expressionPieces.slice(1)) {
        let parsed = espree.parse(func).body[0].expression;
        if (parsed.type === 'CallExpression') {
          parsed.arguments.unshift(espree.parse(expression).body[0].expression);
          expression = escodegen.generate(parsed);
        } else {
          expression = `${func}(${expression})`;
        }
      }
      let leadingString = str.substring(0, match.index);
      let trailingString = str.substring(match.index + match[0].length);
      return {leadingString, expression, trailingString, isOneTime};
    }
    var pieces = [];
    while(true) {
      let matched = matchFirstExpression(str);
      if (matched == null) {
        if (str) {
          pieces.push({string: str});
        }
        break;
      }
      let {leadingString, expression, trailingString, isOneTime} = matched;
      if (leadingString) {
        pieces.push({string: leadingString});
      }
      pieces.push({expression: expression, isOneTime});
      str = trailingString;
    }
    return pieces;
  }

  /**
   * Upgrades the given script element in place, or if it's a remote script whose
   * source can be found, returns the pair [absoluteFilename, newSource].
   *
   * Returns undefined if the script's source can't be found, or if the script
   * is inline and has been upgraded in place.
   *
   * @param {string} docFilename The absolute path to the containing document.
   * @param {?string} implicitElemName The name of the <polymer-element> that
   *    contains this script, if any.
   * @return {?Array<string>}
   */
  upgradeScriptElement(scriptElem, implicitElemName) {
    if ('src' in scriptElem.attribs) {
      let srcPath = scriptElem.attribs.src;
      let pathToScriptElem;
      if (this.webserverRoot && srcPath.startsWith('/') &&
          !srcPath.startsWith('//')) {
        pathToScriptElem = path.resolve(path.join(this.webserverRoot, srcPath));
      } else if (PathResolver.prototype.isAbsoluteUrl(srcPath)) {
        // Skip other absolute URLs, they're things like http://ok.com/jquery.js
        return;
      } else {
        pathToScriptElem = path.resolve(path.dirname(this.filename), srcPath);
      }

      if (this.toIgnore.has(pathToScriptElem)) {
        return;
      }
      let scriptSource;
      try {
        scriptSource = fs.readFileSync(pathToScriptElem, 'utf-8');
      } catch(e) {
        console.warn(`Warning: unable to read script source for ${srcPath}`);
        return;
      }
      let upgradedJs = upgradeJs(
          scriptSource, this.elements, implicitElemName, 0, this.onlyReformat);
      if (upgradedJs) {
        this.results[pathToScriptElem] = `${upgradedJs}\n`;
      }
    } else {
      let upgradedJs = upgradeJs(
          this.$(scriptElem).text(), this.elements, implicitElemName, 2,
          this.onlyReformat
      );
      if (upgradedJs) {
        this.modified = true;
        this.$(scriptElem).text(`\n${upgradedJs}\n  `);
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
  recursivelyMatchInsideTemplates(elem, matcher, results) {
    elem = this.$(elem);
    if (results == null) {
      results = [];
    }
    if (elem.is('template')) {
      elem[0].children.forEach((child) => {
        this.recursivelyMatchInsideTemplates(child, matcher, results);
      });
    }
    elem.find(matcher).each((_ignored, matched) => {
      results.push(matched);
    });
    elem.find('template').each((_ignored, templateElem) => {
      templateElem.children.forEach((child) => {
        this.recursivelyMatchInsideTemplates(child, matcher, results);
      });
    });
    return results;
  }

  /**
   * Upgrades the given <template repeat> element to a dom-repeat.
   *
   * @param {TemplateElement} templateElem The template repeat element to upgrade.
   */
  upgradeTemplateRepeat(templateElem) {
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
      this.insertHtmlCommentBefore(templateElem, [
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
   * @param {Element} elem The HTML element to precede with comments.
   * @param {Array<string>} commentLines The lines of the comment to insert.
   */
  insertHtmlCommentBefore(elem, commentLines) {
    var indent = '';
    if (elem.previousSibling && elem.previousSibling.type == 'text') {
      var previousText = elem.previousSibling.data;
      var match = previousText.match(/\n*( +)\n*/);
      if (match) {
        indent = match[1];
      }
    }
    var commentText = '<!--\n';
    commentLines.forEach((line) => {
      if (line.charAt(line.length - 1) == ' ') {
        throw new Error('Comment ends with a space?');
      }
      commentText += `${indent}    ${line}\n`;
    });
    commentText += `${indent} -->\n${indent}`;
    this.$(elem).before(commentText);
  }

  addHtmlImport(pathWithinComponents) {
    // Don't add duplicate imports.
    var importExists = false;
    this.$('link[rel=import][href]').each((_ignored, linkElem) => {
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
    this.$('link[rel=import][href], script[src]').each((_ignored, elem) => {
      var path = elem.attribs.href || elem.attribs.src;
      var pathExtractor = /(.*)(polymer\/polymer\.html|webcomponentsjs\/webcomponents(-lite)?(\.min)?\.js)$/;
      var match = path.match(pathExtractor);
      if (match) {
        pathToComponents = match[1];
      }
    });
    pathToComponents = this.componentsPath || pathToComponents;
    var newImport = this.$('<link>').attr('rel', 'import');
    this.$('head').append('  ');
    this.$('head').append(newImport);
    this.$('head').append('\n');
    if (pathToComponents) {
      newImport.attr('href', pathToComponents + pathWithinComponents);
    } else {
      newImport.attr('href', pathWithinComponents);
      this.insertHtmlCommentBefore(newImport[0], [
          'TODO(polyup): unable to infer path to components',
          'directory. This import path is probably incomplete.'
      ]);
    }
  }

}

/**
 * Upgrades an HTML file and any referenced scripts from Polymer 0.5 to 1.0.
 * @param {string} filename Path to the html file to upgrade.
 * @return {Object<string, string>} A map from filename to upgraded file
 *     contents. The filenames are all absolute. The contents are UTF-8 strings.
 */
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
  elem.children.forEach((child) => {
    if (child.type === 'text') {
      results.push(child);
    } else if(child.children) {
      findAllTextNodes(child, results);
    }
  });
  return results;
}


function getCssTextGivenRules(cssRules) {
  var contents = `
    /* TODO(polyup): For speed, consider reworking these styles with .classes
                     and #ids rather than [attributes].
    */`;

  for (var selector in cssRules) {
    contents += `\n    ${selector} ${cssRules[selector]}`;
  }
  contents += '\n  ';
  return contents;
}

const ALWAYS_CONVERT_ATTRIBS = new Set(['class', 'href', 'style', 'role']);
function shouldConvertToAttributeBinding(attrName, element) {
  // Logic copied from
  // https://www.polymer-project.org/1.0/docs/devguide/data-binding.html#native-binding
  if (attrName.charAt(attrName.length - 1) === '$') {
    return false;  // It's already an attribute binding.
  }
  if (attrName.charAt(attrName.length - 1) === '?') {
    return true;
  }
  if (ALWAYS_CONVERT_ATTRIBS.has(attrName)) {
    return true;
  }
  if (element.name === 'label' && attrName === 'for') {
    return true;
  }
  if (attrName.match(/^data-/)) {
    return true;
  }
  if (attrName.match(/^aria-/)) {
    return true;
  }

  return false;
}

module.exports = upgradeHtml;
