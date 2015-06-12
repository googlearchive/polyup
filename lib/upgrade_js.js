'use strict';

var espree = require('espree');
var escodegen = require('escodegen');
var estree_walker = require('estree-walker');
var _ = require('lodash');


function upgradeJs(jsSource, implicitAttrs, implicitHostAttrs, implicitElemName, initialIndent) {
  if (initialIndent == null) {
    initialIndent = 0;
  }
  var ast = espree.parse(jsSource, {attachComment: true});

  var polymerCalls = [];
  // DO NOT SUBMIT - I've patched estree_walker, what do
  estree_walker.walk(ast, {
    enter: function(node) {
      if (node.type === 'CallExpression' && node.callee.name == 'Polymer') {
        polymerCalls.push(node);
      }
    }
  });

  var implicitNameUsed = false;

  polymerCalls.forEach(function(polyCall) {
    var name = extractExplicitElementNameFromPolymerCall(polyCall);
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

    var declaration = polyCall.arguments[0];
    if (declaration == null) {
      declaration = {type: 'ObjectExpression', properties: []};
      polyCall.arguments.push(declaration);
    }
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


    // hostAttributes
    var hostAttrsProperties = [];
    for (var key in hostAttrs) {
      var astVal = {type: 'Literal', value: hostAttrs[key]};
      if (astVal.value === 'true') {
        astVal.value = true;
      }
      hostAttrsProperties.push({
        type: 'Property',
        key: {type: 'Identifier', name: key},
        value: astVal
      });
    }
    if (hostAttrsProperties.length > 0) {
      declaration.properties.push({
        type: 'Property',
        key: {type: 'Identifier', name: 'hostAttributes'},
        value: {
          type: 'ObjectExpression',
          properties: hostAttrsProperties
        }
      });
    }

    // Create a 'properties' block with all of the properties we've extracted
    // from various places (the 'attributes' attribute, computed properties,
    // observed properties, default values, etc etc).
    migrateAttributesToPropertiesBlock(declaration, attrs);

    // domReady -> ready
    var domReadyBody = null;
    declaration.properties.forEach(function(prop) {
      if (getPropertyKeyName(prop) != 'domReady') {
        return;
      }
      if (prop.value.type !== 'FunctionExpression') {
        throw new Error(
            'Expected the value of the `domReady` property to ' +
            'be a function expression.');
      }
      domReadyBody = prop.value.body.body;
    });
    if (domReadyBody != null) {
      var readyBody = null;
      declaration.properties.forEach(function(prop) {
        if (getPropertyKeyName(prop) != 'ready') {
          return;
        }
        if (prop.value.type !== 'FunctionExpression') {
          throw new Error(
              'Expected the value of the `ready` property to ' +
              'be a function expression.');
        }
        readyBody = prop.value.body.body;
      });

      if (readyBody == null) {
        readyBody = [];
        declaration.properties.push({
          type: 'Property',
          key: {type: 'Identifier', name: 'ready'},
          value: {type: 'FunctionExpression', params: [], body: {
            type: 'BlockStatement',
            body: readyBody
          }}
        });
      }
      domReadyBody.forEach(function(expr) {
        readyBody.push(expr);
      });
    }
    declaration.properties = declaration.properties.filter(function(prop) {
      return getPropertyKeyName(prop) != 'domReady';});
  });

  return escodegen.generate(ast, {comment: true, format: {indent: { style: '  ', base: initialIndent, adjustMultilineComment: true}}});
}


function extractExplicitElementNameFromPolymerCall(polymerCall) {
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

function migrateAttributesToPropertiesBlock(declaration, attrs) {
  // migrate the publish block
  declaration.properties.forEach(function(property) {
    if (getPropertyKeyName(property) != 'publish') {
      return;
    }
    if (property.value.type != 'ObjectExpression') {
      throw new Error(
          'Hm, we expected that the publish property of your ' +
          'Polymer element would be an object expression ' +
          '(i.e. { key: "val" }).');
    }
    property.value.properties.forEach(function(publishedProp) {
      var attrName = getPropertyKeyName(publishedProp);
      var attr = attrs[attrName] || {name: attrName};
      attr.notify = {type: 'Literal', value: true};
      if (publishedProp.leadingComments) {
        attr.leadingComments = publishedProp.leadingComments;
      }
      if (publishedProp.value.type === 'ObjectExpression') {
        updateAttrsFromPublishBlock(publishedProp.value, attr);
      } else {
        attr.value = publishedProp.value;
      }
    });
  });
  declaration.properties = declaration.properties.filter(function(prop) {
      return getPropertyKeyName(prop) != 'publish';});

  // Migrate default values from the object itself
  declaration.properties.forEach(function(prop) {
    var propName = getPropertyKeyName(prop);
    if (propName in attrs) {
      attrs[propName].value = prop.value;
    }
  });
  declaration.properties = declaration.properties.filter(function(prop) {
    return !(getPropertyKeyName(prop) in attrs);
  });

  var attr;
  // Infer types from default values
  for (var attrName in attrs) {
    attr = attrs[attrName];
    if (attr.type || !attr.value) {
      continue;
    }
    var value = attr.value;
    var typeName;
    if (value.type === 'ObjectExpression') {
      typeName = 'Object';
    } else if (value.type === 'ArrayExpression') {
      typeName = 'Array';
    } else if (value.type === 'Literal') {
      typeName = typeof value.value;
      // need to turn the type name into the identifier, so 'number' -> Number
      typeName = typeName.charAt(0).toUpperCase() + typeName.substring(1);
      if (!_.contains(['Date', 'Boolean', 'Number', 'String'], typeName)) {
        continue;
      }
    } else {
      continue;
    }
    attr.type = {type: 'Identifier', name: typeName};
  }

  // Transform Object and Array default values into functions returning same
  for (attrName in attrs) {
    attr = attrs[attrName];
    if (!attr.value) {
      continue;
    }
    if (!_.contains(['ObjectExpression', 'ArrayExpression'], attr.value.type)) {
      continue;
    }
    attr.value = {
        type: 'FunctionExpression', params: [],
            body: {type: 'BlockStatement', body:[{
                type: 'ReturnStatement', argument: attr.value}]}};
  }

  // Make implicit observers like fooChanged explicit
  declaration.properties.forEach(function(prop) {
    var propName = getPropertyKeyName(prop);
    if (!propName.endsWith('Changed')) {
      return;
    }
    var attrName = propName.substring(0, propName.length - 7);
    attrs[attrName] = attrs[attrName] || {name: attrName};
    attrs[attrName].observer = {type: 'Literal', value: propName};
    fixObserverArgumentOrder(prop.value);
  });

  var observerFunctionNames = new Set();
  declaration.properties.forEach(function(prop) {
    if (getPropertyKeyName(prop) !== 'observe') {
      return;
    }
    if (prop.value.type !== 'ObjectExpression') {
      throw new Error(
          'Expected the "observe" field on ' + attr.name +
          ' to be an observed properties declaration, a la ' +
          'https://www.polymer-project.org/0.5/docs/' +
          'polymer/polymer.html#observeblock');
    }
    prop.value.properties.forEach(function(observedProp) {
      var propName = getPropertyKeyName(observedProp);
      var attrNames = propName.split(/\s+/);
      if (observedProp.value.type !== 'Literal' ||
          (typeof observedProp.value.value) !== 'string') {
        throw new Error(
            'Expected the observer name of the observed property ' +
            propName + ' to be a string, not ' +
            JSON.stringify(observedProp.value) + '.');
      }
      var observerFunctionName = observedProp.value.value;
      observerFunctionNames.add(observerFunctionName);
      attrNames.forEach(function(attrName) {
        if (attrName.indexOf('\.') != -1 || attrName.indexOf('[') != -1) {
          console.warn('Warning: Observing nested values is not supported.');
        }
        attrs[attrName] = attrs[attrName] || {name: attrName};
        attrs[attrName].observer = {
            type: 'Literal', value: observerFunctionName};
      });
    });
  });
  declaration.properties = declaration.properties.filter(function(prop) {
    return getPropertyKeyName(prop) != 'observe';
  });
  declaration.properties.forEach(function(prop) {
    var propName = getPropertyKeyName(prop);
    if (!observerFunctionNames.has(propName)) {
      return;
    }
    if (prop.value.type !== 'FunctionExpression') {
      throw new Error(
          "Expected that the registered observer " +
          propName + " would be a function, not a " + value.prop.type);
    }
    fixObserverArgumentOrder(prop.value);
  });

  // Handle old-style computed properties
  var newComputedFunctions = [];
  declaration.properties.forEach(function(prop) {
    if (getPropertyKeyName(prop) != 'computed') {
      return;
    }
    if (prop.value.type !== 'ObjectExpression') {
      throw new Error(
          "Expected that the value of the 'computed' property would be a " +
          "computed properties declaration, a la " +
          "https://www.polymer-project.org/0.5/docs" +
          "/polymer/polymer.html#computed-properties");
    }
    prop.value.properties.forEach(function(computedProp) {
      var computedPropName = getPropertyKeyName(computedProp);
      if (computedProp.value.type !== 'Literal' ||
          typeof computedProp.value.value !== 'string') {
        throw new Error(
            "Expected the expression value of computed property " +
            computedPropName + " to be a string.");
      }
      var computedExpression = computedProp.value.value;
      var fixupResult = fixupComputedExpression(computedPropName, computedExpression);
      var newComputedExpression = fixupResult[0];
      var newDeclaration = fixupResult[1];
      attrs[computedPropName] = attrs[computedPropName] || {name: computedPropName};
      attrs[computedPropName].computed = newComputedExpression;
      newComputedFunctions.push(newDeclaration);
    });
  });
  newComputedFunctions.sort(function(a, b) {
    return getPropertyKeyName(a).localeCompare(getPropertyKeyName(b));
  });
  declaration.properties = declaration.properties.concat(newComputedFunctions);
  declaration.properties = declaration.properties.filter(function(prop) {
    return getPropertyKeyName(prop) != 'computed';
  });

  // Now to take all this info and generate the properties block
  if (Object.keys(attrs).length === 0) {
    return;
  }
  var propertiesObjAst = {type: 'ObjectExpression', properties: []};
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
      value: attrObj,
      leadingComments: attr.leadingComments || [],
    });
    var propertyAnnotationsWeWillGenerate = [
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
  });
}

function getPropertyKeyName(propertyAst) {
  var key = propertyAst.key;
  if (propertyAst.type !== 'Property') {
    throw new Error('Type Error: expected Property, got ' + propertyAst.type);
  }
  switch(key.type) {
    case 'Literal':
      return key.value.toString();
    case 'Identifier':
      return key.name;
    default:
      throw new Error('Unexpected property key:' + JSON.stringify(key));
  }
}

function updateAttrsFromPublishBlock(publishAttrObjAst, attr) {
  publishAttrObjAst.properties.forEach(function(prop) {
    var propName = getPropertyKeyName(prop);
    if (propName === 'value') {
      attr.value = prop.value;
    }
    if (propName === 'reflect') {
      attr.reflectToAttribute = prop.value;
    }
  });
}



function fixObserverArgumentOrder(observerFuncAst) {
  var paramsAst = observerFuncAst.params;
  if (paramsAst.length === 0) {
    // no problem
    return;
  } else if (paramsAst.length === 1) {
    paramsAst.unshift({type: 'Identifier', name: '_'});
  } else {
    var firstParam = paramsAst[0];
    var secondParam = paramsAst[1];
    paramsAst[0] = secondParam;
    paramsAst[1] = firstParam;
  }
}



function fixupComputedExpression(attrName, expression) {
  var functionExpression = 'function x() { return (' + expression + ') }';
  var parsed = espree.parse(functionExpression);
  parsed = parsed.body[0].body.body[0].argument;
  var identifierCounts = {};
  var expressionDependencies = new Set();
  var astNodes = [];
  estree_walker.walk(parsed, {
    enter: function(node) {
      astNodes.push(node);
    }
  });
  astNodes.forEach(function(node) {
    if (node.type === 'Identifier') {
      identifierCounts[node.name] = identifierCounts[node.name] || 0;
      identifierCounts[node.name]++;
    } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      identifierCounts[node.name] = identifierCounts[node.name] || 0;
      identifierCounts[node.name]--;
    }
  });
  estree_walker.walk(parsed, {
    enter: function(node, parent) {
      if (node.type === 'Identifier') {
        if (parent.type === 'Property' && parent.key === node) {
          return;
        }
        var identifierName = node.name;
        // This is technically illegal, but it works!
        node.name = "this." + node.name;
        if (parent.type === 'CallExpression' && parent.callee === node) {
          return;
        }
        expressionDependencies.add(identifierName);
      }
    }
  });

  var computedArgs = [];
  expressionDependencies.forEach(function(depName) {
    computedArgs.push(depName);
  });
  computedArgs.sort();
  var computedIdentifiers = computedArgs.map(function(argName) {
    return {type: 'Identifier', name: argName};
  });
  var externalComputedFunctionName = 'compute' +
      attrName.charAt(0).toUpperCase() + attrName.substring(1);
  var expr = {
    type: 'Property',
    key: {type: 'Identifier', name: externalComputedFunctionName},
    value: {
      type: 'FunctionExpression', id: null, params: computedIdentifiers,
      body: {
        type: 'BlockStatement',
        body: [{type: 'ReturnStatement', argument: parsed}]
      }
    }
  };

  var newComputedExpression = {
    type: 'Program',
    body: [{
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {type: 'Identifier', name: externalComputedFunctionName},
        arguments: computedIdentifiers
      }
    }]
  };
  var computedLiteral = {
    type: 'Literal',
    value: escodegen.generate(
        newComputedExpression, {format: {indent: { style: ''}, newline: ' ', semicolons: false}})
  };
  return [computedLiteral, expr];
}

module.exports = upgradeJs;
