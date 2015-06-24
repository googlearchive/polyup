# polyup

### Automates the boring parts of migrating your code from Polymer 0.5 to 1.0.

The change from Polymer 0.5 to 1.0 is a large one, as many things changed as we
transitioned from an exploratory beta releases to a stable production-ready
product.

Fortunately many of these changes can be done automatically. `polyup` will
parse your HTML and any javascript in either inline or external scripts and
perform a number of automatic transformations to your code.

For most projects `polyup` won't be able to do everything necessary to upgrade,
but its goal is to make it way easier.

## Installation

`polyup` is available on npm. We recommend installing `polyup` globally.

    npm install -g polyup

This will install `polyup` to the bin directory configured when node was
installed. (e.g. `/usr/local/bin/polyup`).  You may need `sudo`
for this step.

## Usage

The command

    polyup photo-lightbox.html

will parse and transform photo-lightbox and any linked javascript that `polyup`
can find and then print the transformed code back out onto the command line.

If that looks good, then you can run `polyup` with the `--overwrite` option to
overwrite your code on disk with the upgraded version. Make sure that you've
got your code checked into source control first, as this will in effect delete
the v0.5 version of your code!

## Reporting Bugs

`polyup` is still in early and active development. Since so many people are looking at migrating to 1.0 right now we thought that it was better to get what
we have now out there now, even if it won't be right for everyone.

Please file bugs as you see them! See CONTRIBUTING.md for more info.

## Transformations

### HTML
- [x] `<polymer-element name='my-elem'>` -> `<dom-module id='my-elem'>`
- [x] Moves direct `<script>` children of `<polymer-element>` elements into
      siblings.
- [x] Migrates `<style>` children from an element's `<template>` into a direct
      child of the `<dom-module>`
- [x] Migrates the `attributes=` attribute off `<polymer-element>` and into
      the `properties` block of the corresponding `Polymer({...})` call.
- [x] Generates a script and `Polymer()` call elements with a `noscript`
      attribute.
- [x] Migrates the `extends` attribute on `<polymer-element>`.
- [x] Warns on extending a custom element.
- [x] Does not process extra `<template>` tags.
- [x] Transforms `<template if='{{x}}'>` into
      `<template is="dom-if" if="{{x}}">`
- [x] Upgrades `<template repeat>`
  - [x] Transforms `<template repeat='{{x in xs}}'>` into
        `<template is='dom-repeat' items='{{xs}}' as='{{x}}'>`
  - [x] Transforms `<template repeat='{{x, i in xs}}'>` into
        `<template is='dom-repeat' items='{{xs}}' as='{{x}}' index-as='{{i}}'>`
- [ ] Upgrades/warns on `<template bind>`
  - [ ] Handles `<template bind='{{x}}'>`
  - [ ] Handles `<template bind='{{x as y}}'>`
- [ ] Upgrades all template data binding expressions.
  - [x] Doesn't touch expressions made up only of identifiers, property
        accesses, or expressions that are just a function call with arguments
        made of identifiers and property accesses.
  - [x] Wraps an expression in a <span> if it is not the only child of an
        element.
  - [x] Transforms an attribute made up of a mix of static string and
        expressions into an anonymous computed property.
  - [x] Transforms more complicated expressions anywhere into anonymous
        computed properties.
  - [ ] Handles expressions with filters like {{x | f}}
  - [ ] Upgrades one time bindings [[]] – probably by turning them into
        regular bindings with a warning because in 1.0 they're *one-way*
        bindings.
  - [ ] For binding to attributes which are not properties like `class` we need
        to use `x$="{{foo}}"` to bind to the HTML attribute.
  - [ ] Handles bidirectional binding to common attributes of build-in elements
    - [x] `<input value>`
    - [x] `<textarea value>`
    - [ ] `<select value>`
    - [ ] *Your feature request here.*
  - [ ] May need to remove curly braces from on-* event handler attributes.
        Investigation needed.

- [x] `webcomponents(.min)?.js` -> `webcomponents_lite(.min)?.js`
- [ ] Upgrades official elements from 0.5 to 1.0 mode.
  - [x] Upgrades imports to the new element names and paths.
  - [x] Upgrades references in HTML.
  - [x] Upgrades attributes to their new names, where changed.
  - [ ] Warns on use of removed attributes.
  - [ ] Warns on use or import of elements that do not yet have a polymer
        version.
  - [ ] Adds additional imports when necessary.
  - [ ] Warns on other major breaking changes to elements.
  - [ ] Upgrades mixins from 0.5 into behaviors of 1.0.

### Javascript
- [x] Infers element name from the context in which a script was loaded.
- [x] Constructs a `properties` block from information inferred from many
      sources.
  - [x] Properties declared in the `publish` block are migrated, with the
        `notify` attribute set.
  - [x] Infers a property and its default value from properties directly
        on the `Polymer({})` declaration
  - [x] Infers type from default value, where present.
  - [x] Converts mutable default values like arrays and objects into
        functions returning that default value.
  - [x] Discover implicit observers from functions declared with the name
        `xChanged` where `x` is a previously discovered property.
  - [x] Migrate explicitly declared observers from an `observe` block.
    - [ ] Get the arguments right here when there are multiple properties
          observed by one function. -- needs a test to be sure we're doing this
          right.
  - [x] Migrate computed properties from a `computed` block, including
        moving the body of an expression into a new function on the
        declaration.
- [x] Migrate the body of the domReady function into the ready function,
      creating one if needed.
- [ ] Rename common methods on all Polymer elements
  - [x] job -> debounce
  - [x] resolvePath -> resolveUrl
  - [ ] Need to generate a complete list of remaining renames.
- [ ] Mostly preserves comments, but there are a number of places where
      they're lost currently.
- [ ] Rename Polymer.import -> Polymer.Base.importHref
- [ ] Replace `addEventListener('polymer-ready', ...)` with
      `addEventListener('web-components-ready', ...)`
- [ ] Warns on usage of the removed trackstart and trackend events.
- [ ] Updates `elem.domMethod` to `Polymer.dom(elem).domMethod`
  - [ ] appendChild, insertBefore removeChild, flush, childNodes, parentNode,
        firstChild, lastChild, firstElementChild, lastElementChild,
        previousSibling, nextSibling, textContent, innerHTML, querySelector,
        querySelectorAll, getDistributedNodes, getDestinationInsertionPoints,
        setAttribute, removeAttribute, classList

### CSS
- [ ] Detect layout attributes in HTML and add them back in to the element's
      `<style>`.
- [ ] Fix `<link rel='stylesheet' href='...'>`

### Other
- [ ] Upgrades bower.json?

