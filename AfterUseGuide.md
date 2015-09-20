# What to do after polyup?    <br>OR<br>     What polyup doesn't do (yet).

- [Bower](#bower)
- [HTML](#html)
  - [Convert camelCase attributes to words-with-dashes in your elements](#convert-camelcase-attributes-to-words-with-dashes-in-your-elements)
  - [`<template bind>`](#template-bind)
- [Javascript](#javascript)
  - [DOM interaction that may affect Polymer elements should use Polymer.dom()](##dom-interaction-that-may-affect-polymer-elements-should-use-polymerdom)
  - [Official element API changes](#official-element-api-changes)
  - [Events](#events)
  - [Custom element inheritance should become behaviors](#custom-element-inheritance-should-become-behaviors)
  - [Polymer API changes](#polymer-api-changes)
  - [The trackstart and trackend events are removed](#the-trackstart-and-trackend-events-are-removed)

## Bower

You'll need to update your bower dependencies from 0.5 to 1.0. You'll need to go from

```json
"dependencies": {
  "polymer": "^0.5.0",
  "paper-button": "Polymer/paper-button^0.5.0"
}
```

to

```json
"dependencies": {
  "polymer": "^1.0",
  "paper-button": "PolymerElements/paper-button^1.0"
}
```

Two things to note there. The obvious one is that 0.5 goes to 1.0. The less obvious one is that the Polymer elements have moved to the PolymerElements repo.

Some elements were also renamed. See [element_mapping.js](lib/element_mapping.js) for the mappings between elements.

This would be fairly straightforwards to implement in polyup, there just hasn't yet been demand.


## HTML

### Convert camelCase attributes to words-with-dashes in your elements

HTML attributes are case insensitive. With 0.5, we papered over this with camelCase attributes, but with 1.0 we've moved to the more idiomatic words-with-dashes for our attributes.

polyup uses a standards compliant HTML parser. The downside of this is that it can't tell where the word boundaries are. For official elements we've got [element_mapping.js](lib/element_mapping.js), but for attributes on other custom elements you'll need to manually update them.

### `<template bind>`



## Javascript

### DOM interaction that may affect Polymer elements should use Polymer.dom()

`elem.domMethod` becomes `Polymer.dom(elem).domMethod`.

Methods to look for:

appendChild, insertBefore removeChild, flush, childNodes, parentNode,
firstChild, lastChild, firstElementChild, lastElementChild,
previousSibling, nextSibling, textContent, innerHTML, querySelector,
querySelectorAll, getDistributedNodes, getDestinationInsertionPoints,
setAttribute, removeAttribute, classList

### Official element API changes

Any time that you're interacting with custom elements through javascript, e.g. with `this.$.myCoreAjaxId.go()` or `document.createElement('core-tooltip')` you'll need to review this code for changes to the APIs of the involved elements.

In these two examples, the coreAjax method `go` was renamed to `generateRequest`, and `'core-tooltip'` was renamed to `'paper-tooltip'`.

### Events

A number of events have changed their names. The most common one is:

```javascript
window.addEventListener('polymer-ready', function() { ... });
```

which should become

```javascript
window.addEventListener('WebComponentsReady', function() { ... });
```

### Custom element inheritance should become behaviors

In 1.0 we're moving away from custom element inheritance. Instead we're encouraging mixin functionality through behaviors.

If you already had a mixin using Polymer.mixin (or Polymer.mixin2) in 0.5, polyup will upgrade that to a behavior. If you've been using inheritance though, you'll want to extract out the shared code into an object that will be mixed into the prototype of the mixed-in behaviors.

### Polymer API changes

e.g.

For imperatively doing HTML imports:

```javascript
Polymer.import(path)
```

```javascript
Polymer.Base.importHref(path)
```

### The `trackstart` and `trackend events` are removed

Just use `track`.

