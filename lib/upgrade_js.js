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
import espree from 'espree';
import escodegen from 'escodegen';
import estree_walker from 'estree-walker';
import _ from 'lodash';
import elementMapping from './element_mapping';

class Script {
  constructor(jsSource, elements, initialIndent, implicitElemName) {
    this.jsSource = jsSource;
    this.elements = elements;
    this.initialIndent = initialIndent;
    this.modified = false;
    this.implicitElemName = implicitElemName;
    this.implicitElemNameUsed = false;
  }

  upgrade() {
    const ast = espree.parse(this.jsSource, {attachComment: true});

    removeDuplicateComments(ast);

    const polymerCalls = [];
    estree_walker.walk(ast, {
      enter: (node) => {
        if (node.type === 'CallExpression' && node.callee.name == 'Polymer') {
          polymerCalls.push(node);
        }
      }
    });

    polymerCalls.forEach(this.upgradePolymerCall.bind(this));

    if (!this.modified) {
      return null;
    }

    return escodegen.generate(ast, {
      comment: true,
      format: {
        indent: {
          style: '  ',
          base: this.initialIndent,
          adjustMultilineComment: true
        }
      }
    });
  }

  /**
   * Upgrade a single Polymer() call.
   */
  upgradePolymerCall(polyCall) {
    this.modified = true;
    var name = extractExplicitElementNameFromPolymerCall(polyCall);
    var attrs = {};
    var hostAttrs = {};
    var behaviors = [];
    var listeners = {};
    var newDeclarations = [];
    if (name == null) {
      if (this.implicitElemName == null) {
        throw new Error('Unable to determine element name in javascript. ' +
            'No matching <polymer-element> found, nor was an explicit name ' +
            'given.');
      }
      if (this.implicitElemNameUsed) {
        throw new Error('Unable to determine element name in javascript. ' +
            'Multiple calls to Polymer() found without an explicit element ' +
            'name.');
      }
      name = this.implicitElemName;
    }
    let elementInfo = {};
    if (this.elements.has(name)) {
      elementInfo = this.elements.get(name);
      attrs = elementInfo.attrs || attrs;
      hostAttrs = elementInfo.hostAttrs || hostAttrs;
      newDeclarations = elementInfo.newDeclarations || newDeclarations;
      listeners = elementInfo.listeners || listeners;
    }

    var declaration = polyCall.arguments[0];
    if (declaration == null) {
      declaration = {type: 'ObjectExpression', properties: []};
      polyCall.arguments.push(declaration);
    }

    while (declaration.type === 'CallExpression') {
      // If the call expression is Polymer.mixin or Polymer.mixin2
      if (declaration.callee.type === 'MemberExpression') {
        var memberExpr = declaration.callee;
        if (memberExpr.object.name === 'Polymer' &&
            _.contains(['mixin', 'mixin2'], memberExpr.property.name)) {
          var mixin = declaration.arguments[1];
          declaration = declaration.arguments[0];
          polyCall.arguments[0] = declaration;
          behaviors.push(mixin);
        }
      }
    }
    if (declaration.type != 'ObjectExpression') {
      throw new Error(
          "Unexpected kind of thing passed to Polymer() - " +
          declaration.type);
    }

    // Create a 'properties' block with all of the properties we've extracted
    // from various places (the 'attributes' attribute, computed properties,
    // observed properties, default values, etc etc).
    migrateAttributesToPropertiesBlock(polyCall, declaration, attrs);

    // hostAttributes
    var hostAttrsProperties = [];
    for (let key in hostAttrs) {
      let astVal = {type: 'Literal', value: hostAttrs[key]};
      if (astVal.value === 'true') {
        astVal.value = true;
      }
      hostAttrsProperties.push({
        type: 'Property',
        key: {type: 'Literal', value: key},
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

    var listenerProperties = [];
    for (let key in listeners) {
      listenerProperties.push({
        type: 'Property',
        key: {type: 'Identifier', name: key},
        value: {type: 'Literal', value: listeners[key]}
      });
    }
    if (listenerProperties.length > 0) {
      declaration.properties.push({
        type: 'Property',
        key: {type: 'Identifier', name: 'listeners'},
        value: {
          type: 'ObjectExpression',
          properties: listenerProperties
        }
      });
    }

    // Add behaviors
    if (behaviors.length > 0) {
      declaration.properties.unshift(getBehaviorsDeclaration(behaviors));
    }

    // Add the is: 'my-elem' property
    declaration.properties.unshift({
      type: 'Property',
      key: { type: 'Identifier', name: 'is'},
      value: { type: 'Literal', value: name}
    });

    // domReady -> ready
    this.migrateDomReadyToReady(declaration);

    var thisMethodRenames = {
      job: 'debounce',
      resolvePath: 'resolveUrl'
    };
    estree_walker.walk(declaration, {
      enter: function(node) {

        if (node.type === 'CallExpression') {
          // this.job -> this.debounce and friends
          if (node.callee.type === 'MemberExpression' &&
              node.callee.object.type === 'ThisExpression' &&
              node.callee.property.name in thisMethodRenames) {
            node.callee.property.name = thisMethodRenames[
                node.callee.property.name];
          }
        }
      }
    });

    const declarationNames = new Set();
    const getDeclName = (decl) => decl.key.name || decl.key.value;
    for (let decl of declaration.properties) {
      declarationNames.add(getDeclName(decl));
    }
    newDeclarations.forEach(function(decl) {
      while(decl.rename && declarationNames.has(getDeclName(decl))) {
        let name = getDeclName(decl);
        let match = name.match(/^(.*)(\d+)$/);
        let newName;
        if (!match) {
          newName = name + '2';
        } else {
          newName = match[1] + (parseInt(match[2], 10) + 1);
        }
        decl.rename(newName);
      }
      declarationNames.add(getDeclName(decl));
      declaration.properties.push(decl);
    });

    if (elementInfo.polyfillTokenList) {
      const ast = espree.parse(`
        (function (obj) {
          var pieces = [];
          for (key in obj) {
            if (obj[key]) {
              pieces.push(key);
            }
          }
          return pieces.join(' ');
        })
      `);
      declaration.properties.push({
        type: 'Property',
        key: { type: 'Identifier', name: 'tokenList'},
        value: ast.body[0].expression
      });
    }
  }

  migrateDomReadyToReady(declaration) {
    let domReadyBody = null;
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
    if (!domReadyBody) {
      return;
    }

    let readyBody = null;
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
    declaration.properties = declaration.properties.filter((prop) => {
        return getPropertyKeyName(prop) != 'domReady';});
  }
}

function upgradeJs(jsSource, elements, implicitElemName=null, initialIndent=0) {
  var script = new Script(jsSource, elements, initialIndent, implicitElemName);
  return script.upgrade();
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

function migrateAttributesToPropertiesBlock(polyCall, declaration, attrs) {
  // migrate default values from directly the declaration
  var literalTypes = new Set(
      ['Literal', 'ObjectExpression', 'ArrayExpression']);
  var wellKnownNames = new Set(
      ['observe', 'computed', 'publish']);
  declaration.properties.forEach(function(property) {
    if (!literalTypes.has(property.value.type)) {
      return;
    }
    var attrName = getPropertyKeyName(property);
    if (wellKnownNames.has(attrName)) {
      return;
    }
    attrs[attrName] = attrs[attrName] || {name: attrName};
    attrs[attrName].value = property.value;
  });
  declaration.properties = declaration.properties.filter(function(prop) {
    if (literalTypes.has(prop.value.type)) {
      if (!wellKnownNames.has(getPropertyKeyName(prop))) {
        return false;
      }
    }
    return true;
  });

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
        if (_.contains(attrName, '.') || _.contains(attrName, '[')) {
          // This is deeply mediocre code. We want to actually create the
          // observers.
          polyCall.leadingComments = polyCall.leadingComments || [];
          polyCall.leadingComments.push(
            {type: 'Line', value: 'TODO(polyup): Need to add an observer of ' +
                attrName + ', calling ' + observerFunctionName + '.'},
            {type: 'Line', value: 'Note that the semantics for observing ' +
                'properties and arrays has changed.'}
          );
        } else {
          attrs[attrName] = attrs[attrName] || {name: attrName};
          attrs[attrName].observer = {
            type: 'Literal', value: observerFunctionName};
        }
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
      var [namer, newDeclaration] = fixupComputedExpression(computedExpression);
      attrs[computedPropName] = attrs[computedPropName] || {name: computedPropName};
      const renameFn = (name) => {
        const newComputedExpression = namer(name);
        attrs[computedPropName].computed = {
            type: 'Literal', value: newComputedExpression};
      };
      renameFn('compute' + computedPropName.charAt(0).toUpperCase() +
          computedPropName.slice(1));
      if (newDeclaration) {
        newDeclaration.rename = renameFn;
        newComputedFunctions.push(newDeclaration);
      }
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
  declaration.properties.unshift({
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

function getBehaviorsDeclaration(behaviors) {
  // Map official elements to their upgraded forms.
  behaviors = behaviors.map(function(behaviorAst) {
    var behaviorName = escodegen.generate(behaviorAst);
    var mappedBehavior = elementMapping[behaviorName];
    if (!mappedBehavior || !mappedBehavior.name) {
      return behaviorAst;
    }
    return espree.parse(mappedBehavior.name).body[0].expression;
  });

  return {
    type: 'Property',
    key: {type: 'Identifier', name: 'behaviors'},
    value: {
      type: 'ArrayExpression',
      elements: behaviors
    }
  };
}

function fixupComputedExpression(expression) {
  const functionExpression = 'function x() { return (' + expression + '); }';
  let parsed = espree.parse(functionExpression);
  parsed = parsed.body[0].body.body[0].argument;
  const leadingComments = [];

  function isObservable(astNode) {
    if (astNode.type === 'Identifier') {
      return true;
    }
    // foo.bar, foo['bar'], foo.bar.baz[1 + 1], etc
    if (astNode.type === 'MemberExpression') {
      // If the thing being accessed is a complex expression, then this
      // isn't observable.
      if (!isObservable(astNode.object)) {
        return false;
      }
      // Otherwise, if it's just foo.bar, then it is.
      if (!astNode.computed) {
        return true;
      }
      // Otherwise, are we accessing a pure literal, like foo['bar']?
      // If so, we're observable.
      return astNode.property.type === 'Literal';
    }
    if (astNode.type === 'UnaryExpression' && astNode.operator === '!') {
      return isObservable(astNode.argument);
    }
    return false;
  }

  // Check to see if we need to do anything to fixup this computed expression.
  // An expression that's just an identifier or member expression, or that's
  // a simple function call on the same can be left as it is.
  if (isObservable(parsed)) {
    return [() => expression, null];
  }
  if (parsed.type === 'CallExpression') {
    var allArgumentsAreObservable = true;
    parsed.arguments.forEach(function(arg) {
      allArgumentsAreObservable = (
          allArgumentsAreObservable && isObservable(arg));
    });
    if (allArgumentsAreObservable) {
      return [() => expression, null];
    }
  }

  // Ok, we've got a complex expression, so we're going to want to move it
  // into a function of its own and rewrite the expression to simply call that
  // function.
  var inputIdentifiers = new Set();
  estree_walker.walk(parsed, {
    enter: function(node, parent) {
      if (node.type === 'Identifier') {
        if (parent && parent.type === 'Property' && parent.key === node) {
          return;
        }
        if (parent && parent.type === 'CallExpression' && parent.callee === node) {
          // This is technically illegal, but it works!
          node.name = "this." + node.name;
          return;
        }
        // If the identifier is the 'bar' in an expression like `foo.bar`, then
        // we don't consider it an input identifier. Only foo should be counted.
        if (parent && parent.type === 'MemberExpression' && parent.property === node) {
          return;
        }
        inputIdentifiers.add(node.name);
      }
    }
  });

  var computedArgs = [];
  inputIdentifiers.forEach(function(depName) {
    computedArgs.push(depName);
  });
  computedArgs.sort();
  var computedIdentifiers = computedArgs.map(function(argName) {
    return {type: 'Identifier', name: argName};
  });

  var declarationOfExpressionFunction = {
    type: 'Property',
    key: {type: 'Identifier', name: 'placeholderMustCallRename'},
    value: {
      type: 'FunctionExpression', id: null, params: computedIdentifiers,
      body: {
        type: 'BlockStatement',
        body: [{type: 'ReturnStatement', argument: parsed}]
      }
    },
    leadingComments: leadingComments
  };

  var newExpressionAst = {
    type: 'Program',
    body: [{
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {type: 'Identifier', name: 'placeholderMustCallRename'},
        arguments: computedIdentifiers
      }
    }]
  };

  function nameComputedFunction(name) {
    declarationOfExpressionFunction.key.name = name;
    newExpressionAst.body[0].expression.callee.name = name;
    return escodegen.generate(
      newExpressionAst,
      {format: {indent: { style: ''}, newline: ' ', semicolons: false}});
  }

  return [nameComputedFunction, declarationOfExpressionFunction];
}

function removeDuplicateComments(ast) {
  // Some comments are duplicated as both the leadingComment for one node,
  // and the trailing comment for another. Every comment's range is unique,
  // so two comments with the same range are talking about the same comment.
  // So we'll just remove all trailing comments which are also a leading
  // comment somewhere.
  const rangesInLeadingComments = new Set();
  estree_walker.walk(ast, {
    enter: (node) => {
      for (let leadingComment of node.leadingComments || []) {
        rangesInLeadingComments.add(leadingComment.range.join(','));
      }
    }
  });
  estree_walker.walk(ast, {
    enter: (node) => {
      if (!node.trailingComments) {
        return;
      }
      node.trailingComments = node.trailingComments.filter((comment) => {
        return !rangesInLeadingComments.has(comment.range.join(','));
      });
    }
  });
}

module.exports = upgradeJs;
upgradeJs.fixupComputedExpression = fixupComputedExpression;
