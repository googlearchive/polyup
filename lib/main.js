'use strict';

var whacko = require('whacko');
var fs = require('fs');
require('string.prototype.endswith')
var upgrade_js = require('./upgrade_js');



function upgradeHtml(filename) {
  var elemSource = fs.readFileSync(filename, 'utf-8');

  var $ = whacko.load(elemSource);

  $('polymer-element').each(function(_, polyElem) {
    var elemName = polyElem.attribs['name'];
    // The properties that are listed in the 'attributes' attribute are published
    // by default. The js upgrade will want to know about this.
    var attrs = {};
    if (polyElem.attribs['attributes']) {
      polyElem.attribs['attributes'].split(/\s+/).forEach(function(publishedAttrName) {
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


    // Uknown attributes are probably intended to be published with hostAttributes
    // if (_.contains(['name', 'attributes', 'noscript', 'extends'], publishedAttrName)) {
    //   return;
    // }

  /*
      host_attrs = {k: v for k,v in poly_elem.attrib.items()
                    if k not in ('name', 'attributes', 'noscript', 'extends')}

      dom_module = etree.Element('dom-module')
      dom_module.attrib['id'] = elem_name
      dom_module.text = '\n'

      template_children = GetChildrenWithTag(poly_elem, "template")
      assert len(template_children) <= 1
      if template_children:
        template = template_children[0]
        # Migrate styles up to be a direct child of dom-module
        for style in template.cssselect('style'):
          dom_module.insert(0, style)
        # Then move the template in after
        dom_module.insert(len(dom_module), template)

      # noscript -> explicit Polymer() call
      if 'noscript' in poly_elem.attrib:
        new_script = etree.Element('script')
        # 0.5 style, the script upgrader below will transform it to 0.9 where
        # it will also add notify properties from attributes etc
        new_script.text = "Polymer('%s', {});" % elem_name
        poly_elem.insert(len(poly_elem), new_script)
  */
      // Upgrade the js
      $('script', polyElem).each(function(_, scriptElem) {
        console.log(upgrade_js);
        var upgradedJs = upgrade_js($(scriptElem).text(), attrs, hostAttrs, elemName);
        $(scriptElem).text('\n' + upgradedJs + '\n');
        // Move the script after the polymer-element.
        $(polyElem).after(scriptElem);
      });


  /*
      # Replace polymer-element with our new shiny dom-module
      poly_elem.getparent().insert(poly_elem.getparent().index(poly_elem) - 1, dom_module)
      poly_elem.drop_tree()
  */
  });
  console.log($.html());
}


console.log('\n\n\n\n\n'); // FIXME: REMOVE
console.log(Math.random());
console.log('\n');

upgradeHtml('./test/fixtures/simple-element.html');
