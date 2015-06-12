'use strict';

var whacko = require('whacko');
var fs = require('fs');
require('string.prototype.endswith');
var upgradeJs = require('./upgrade_js');
var _ = require('lodash');


function upgradeHtml(filename) {
  var elemSource = fs.readFileSync(filename, 'utf-8');

  var $ = whacko.load(elemSource);

  $('polymer-element').each(function(_ignored, polyElem) {
    var elemName = polyElem.attribs.name;
    // The properties that are listed in the 'attributes' attribute are published
    // by default. The js upgrade will want to know about this.
    var attrs = {};
    if (polyElem.attribs.attributes) {
      polyElem.attribs.attributes.split(/\s+/).forEach(function(publishedAttrName) {
        if (!publishedAttrName) {
          return;
        }
        attrs[publishedAttrName] = {
          name: publishedAttrName,
          notify: { type: 'Literal', value: true}
        };
      });
    }
    var hostAttrs = {};

    // Unknown attributes are probably intended to be published with
    // hostAttributes
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

    var templateChildren = $(polyElem).find('template');
    if (templateChildren.length > 1) {
      throw new Error(
          'Expected a <polymer-element> to have at most one ' +
          'direct <template> child.');
    }
    if (templateChildren[0]) {
      var template = templateChildren[0];
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

    // Upgrade the js
    $('script', polyElem).each(function(_, scriptElem) {
      var upgradedJs = upgradeJs(
          $(scriptElem).text(), attrs, hostAttrs, elemName, 1);
      $(scriptElem).text('\n' + upgradedJs + '\n');
      // Move the script after the polymer-element.
      $(polyElem).after(scriptElem);
    });

    // Replace the <polymer-element> with our shiny new <dom-module>
    $(polyElem).replaceWith(domModule);
    domModule.after('\n');
  });

  var result = $.html() + '\n';

  // If the source didn't include an <html> or a <body> then we can remove the
  // html boilerplate
  if (!/<html>/.test(elemSource)) {
    result = result.replace(/^<html><head>/, '');
    result = result.replace(/<\/head><body>/, '');
    result = result.replace(/<\/body><\/html>\n/, '');
  }
  return result;


  // TODOS:
  // external scripts
  // template if
  // template repeat
  // expressions in templates, use FixComputedExpression
  // extends must be a built-in element
  // remove curly braces from on-* event handler attributes
  // convert attributes in template from camelCase to dash-case
  // detect layout attributes. Warn? Try to do the right thing?
  // replace polymer-ready with web-components-ready
  // warn on trackstart and trackend events
  // Do we need to convert this.x = y to this._setX(y) for properties?
  // look for:
  //   appendChild, insertBefore, removeChild, flush, childNodes, parentNode,
  //   firstChild, lastChild, firstElementChild, lastElementChild,
  //   previousSibling, nextSibling, textContent, innerHTML, querySelector,
  //   querySelectorAll, getDistributedNodes, getDestinationInsertionPoints,
  //   setAttribute, removeAttribute, classList
}


module.exports = upgradeHtml;
