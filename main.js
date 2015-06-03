var espree = require('espree')
var escodegen = require('escodegen');
var whacko = require('whacko');
var fs = require('fs');
var _ = require('lodash');
var estree_walker = require('estree-walker');

var elemSource = fs.readFileSync('./test/fixtures/simple-element.html', 'utf-8');

var $ = whacko.load(elemSource);

console.log('\n\n\n\n\n'); // FIXME: REMOVE

function ExtractExplicitElementNameFromPolymerCall(polymerCall) {
  var args = polymerCall.arguments;
  if (args.length === 0) {
    console.warn('Found a Polymer() call without an argument?');
    return null;
  }

  if (args[0].type === 'Literal' && typeof args[0].value === 'string') {
    var name = args[0].value;
    args.shift();
    return name;
  }

  return null;
}

function UpgradeJs(jsSource, implicitAttrs, implicitHostAttrs, implicitElemName) {
  var ast = espree.parse(jsSource, {attachComment: true});

  var polymerCalls = [];
  // DO NOT SUBMIT - I've not patched estree_walker, what do
  estree_walker.walk(ast, {
    enter: function(node, parent) {
      if (node.type === 'CallExpression' && node.callee.name == 'Polymer') {
        polymerCalls.push(node);
      }
    }
  });

  implicitNameUsed = false;

  polymerCalls.forEach(function(polyCall) {
    var name = ExtractExplicitElementNameFromPolymerCall(polyCall);
    var attrs = {};
    var hostAttrs = {};
    if (name == null) {
      if (implicitElemName == null) {
        throw new Error('Unable to determine element name in javascript. ' +
            'No matching <polymer-element> found, nor was an explicit name ' +
            'given.');
      }
      if (implicitNameUsed) {
        throw new Error('Unable to determine element name in javascript. ' +
            'Multiple calls to Polymer() found without an explicit element ' +
            'name.');
      }
      name = implicitElemName;
    }
    if (implicitElemName != null && name != null && name === implicitElemName) {
      // Yep, we're talking about the same element, use the attributes and
      // host attributes for it!
      attrs = implicitAttrs;
      hostAttrs = implicitHostAttrs;
    }

    declaration = polyCall.arguments[0]
    // TODO(rictic): handle Polymer.mixin here
    if (declaration.type != 'ObjectExpression') {
      throw new Error(
          "Unexpected kind of thing passed to Polymer() - " +
          declaration.type);
    }
    // Add the is: 'my-elem' property
    declaration.properties.unshift({
      type: 'Property',
      key: { type: 'Identifier', name: 'is'},
      value: { type: 'Literal', value: name}
    });


//   # hostAttributes
//   if host_attrs:
//     attrs_obj = ast.Object([])
//     declaration.properties.append(ast.Assign(':', ast.Identifier('hostAttributes'), attrs_obj))
//     for key, val in host_attrs.items():
//       ast_val = ast.String("'%s'" % val)
//       if val == 'true':
//         ast_val = ast.Boolean('true')
//       attrs_obj.properties.append(ast.Assign(':', ast.Identifier(key), ast_val))

    // properties
    MigrateAttributesToPropertiesBlock(declaration, attrs)

//   # domReady -> ready
//   domReadyBody = None
//   for prop in declaration.properties:
//     if prop.left.value.strip('"\'') == 'domReady':
//       assert isinstance(prop.right, ast.FuncExpr)
//       domReadyBody = prop.right.elements
//   if domReadyBody:
//     readyFuncBody = None
//     for prop in declaration.properties:
//       if prop.left.value.strip('"\'') == 'ready':
//         assert isinstance(prop.right, ast.FuncExpr)
//         readyFuncBody = prop.right.elements
//     if not readyFuncBody:
//       readyFuncBody = []
//       declaration.properties.append(ast.Assign(':', ast.Identifier('ready'), ast.FuncExpr(None, [], readyFuncBody)))
//     readyFuncBody += domReadyBody
//     declaration.properties
  });

  return escodegen.generate(ast, {comment: true, format: {indent: { style: '  '}}});
}

function MigrateAttributesToPropertiesBlock(declaration, attrs) {
  declaration.properties.forEach(function(property) {
    if (property.key.name != 'publish') {
      return;
    };
    if (property.value.type != 'ObjectExpression') {
      throw new Error(
          'Hm, we expected that the publish property of your ' +
          'Polymer element would be an object expression ' +
          '(i.e. { key: "val" }).')
    }
    property.value.properties.forEach(function(publishedProp) {
      var attrName = publishedProp.key.name;
      var attr = attrs[attrName] || {name: attrName};
      attr.notify = {type: 'Literal', value: true};
      if (publishedProp.leadingComments) {
        attr.leadingComments = publishedProp.leadingComments;
      }
    });
  });
/*
        attr_name = published_prop.left.value.strip('"\'')
        attr = attrs.get(attr_name, {"name": attr_name, "notify": ast.Boolean('true')})
        if isinstance(published_prop.right, ast.Object):
          UpdateAttrsFromPublishBlock(published_prop.right, attr)
        else:
          attr['value'] = published_prop.right

  declaration.properties = [p for p in declaration.properties if p.left.value.strip('"\'') != 'publish']

  for prop in declaration.properties:
    if prop.left.value.strip('"\'') in attrs:
      attrs[prop.left.value.strip('"\'')]['value'] = prop.right
  declaration.properties = [p for p in declaration.properties if p.left.value.strip('"\'') not in attrs]

  # Infer types
  for attr in attrs.values():
    if 'type' in attr or 'value' not in attr:
      continue
    value = attr['value']
    type_mappings = ((ast.Boolean, 'Boolean'), (ast.Number, 'Number'), (ast.String, 'String'), (ast.Array, 'Array'), (ast.Object, 'Object'))
    for ast_type, js_name in type_mappings:
      if isinstance(value, ast_type):
        attr['type'] = ast.Identifier(js_name)
        break

  # Transform Object and Array default values into functions returning same
  for attr in attrs.values():
    if 'value' not in attr:
      continue
    if not (isinstance(attr['value'], ast.Object) or isinstance(attr['value'], ast.Array)):
      continue
    attr['value'] = ast.FuncExpr(
        None, [], [ast.ExprStatement(ast.Return(attr['value']))])

  # Handle implicit observers
  for prop in declaration.properties:
    if prop.left.value.strip('"\'').endswith('Changed'):
      observed_attribute_name = prop.left.value.strip('"\'')[:-7]
      attrs[observed_attribute_name] = attrs.get(observed_attribute_name,
          {'name': observed_attribute_name})
      attrs[observed_attribute_name]['observer'] = ast.String(
          "'%s'" % prop.left.value.strip('"\''))
      FixObserverArgumentOrder(prop.right)

  # Handle explicit property observers
  observer_function_names = set()
  for prop in declaration.properties:
    if prop.left.value.strip('"\'') == 'observe':
      if not isinstance(prop.right, ast.Object):
        raise Exception("Expected that 'observe' would refer to an observed properties declaration, a la https://www.polymer-project.org/0.5/docs/polymer/polymer.html#observeblock")
      for observed_prop in prop.right.properties:
        attr_names = observed_prop.left.value.strip('"\'').split()
        observer_fn_name = observed_prop.right.value.strip('"\'')
        observer_function_names.add(observer_fn_name)
        for attr_name in attr_names:
          if '.' in attr_name:
            print 'Observing nested objects like %r isn\'t supported in Polymer > 0.5' % attr_name
          attrs[attr_name] = attrs.get(attr_name, {'name': attr_name})
          attrs[attr_name]['observer'] = ast.String("'%s'" % observer_fn_name)
  declaration.properties = [p for p in declaration.properties if p.left.value.strip('"\'') != 'observe']
  for prop in declaration.properties:
    if prop.left.value.strip('"\'') in observer_function_names:
      if not isinstance(prop.right, ast.FuncExpr):
        raise Exception("Expected that the registered observer %s would be a function" % prop.left.value)
      FixObserverArgumentOrder(prop.right)


  # Handle old-style computed properties
  new_computed_functions = []
  for prop in declaration.properties:
    if prop.left.value.strip('"\'') == 'computed' :
      if not isinstance(prop.right, ast.Object):
        raise Exception("Expected that 'computed' would refer to a computed properties declaration, a la https://www.polymer-project.org/0.5/docs/polymer/polymer.html#computed-properties")
      for computed_prop in prop.right.properties:
        attr_name = computed_prop.left.value.strip('"\'')
        if not isinstance(computed_prop.right, ast.String):
          raise Exception("Expected the expression value of computed property %r to be a string, instead it was %s" % (attr_name, computed_prop.right))
        computed_expression = computed_prop.right.value[1:-1]
        (new_computed_expression, new_declaration) = FixupComputedExpression(
            attr_name, computed_expression)
        attrs[attr_name] = attrs.get(attr_name, {"name": attr_name})
        attrs[attr_name]['computed'] = new_computed_expression
        new_computed_functions.append(new_declaration)
  declaration.properties += sorted(new_computed_functions, key=lambda assgn: assgn.left.value)
  declaration.properties = [p for p in declaration.properties if p.left.value.strip('"\'') != 'computed']
*/
  // Now to take all this info and generate the properties block
  if (Object.keys(attrs).length == 0) {
    return;
  }
  propertiesObjAst = {type: 'ObjectExpression', properties: []};
  declaration.properties.splice(1, 0, {
      type: 'Property',
      key: {type: 'Identifier', name: 'properties'},
      value: propertiesObjAst
  });
  Object.keys(attrs).sort().forEach(function(attrName) {
    var attr = attrs[attrName];
    var attrObj = {type: 'ObjectExpression', properties: []};
    propertiesObjAst.properties.push({
      type: 'Property',
      key: {type: 'Identifier', name: attr.name},
      value: attrObj
    });
    propertyAnnotationsWeWillGenerate = [
        'type', 'value', 'notify', 'observer',
        'computed', 'reflectToAttribute'];
    propertyAnnotationsWeWillGenerate.forEach(function(propertyAnnotation) {
      if (!(propertyAnnotation in attr)) {
        return;
      }
      attrObj.properties.push({
        type: 'Property',
        key: {type: 'Identifier', name: propertyAnnotation},
        value: attr[propertyAnnotation]
      });
    });
    if (attr.leadingComments) {
      attrObj.leadingComments = attr.leadingComments;
    }
  });
}


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
      var upgradedJs = UpgradeJs($(scriptElem).text(), attrs, hostAttrs, elemName);
      $(scriptElem).text('\n' + upgradedJs + '\n');
      // Move the script after the polymer-element.
      $(polyElem).after(scriptElem);
    }) ;


/*
    # Replace polymer-element with our new shiny dom-module
    poly_elem.getparent().insert(poly_elem.getparent().index(poly_elem) - 1, dom_module)
    poly_elem.drop_tree()
*/
})
console.log($.html());

// debugger;
