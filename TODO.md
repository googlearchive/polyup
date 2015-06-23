## TODO

    use all of the information encoded in element_mapping.js
    Add comments when moving domReady into ready?
    Ensure we're handling arguments correctly to observe functions in a 0.5
      observe: {} block
    Polymer.import -> Polymer.base.importHref
    handle binding on a <select> element's value.
    handle mixins
    Expressions with filters, i.e. {{x | f}}
    Handle <template bind='{{x}}'> and <template bind='{{x as y}}'>
    Handle <template autobind> -> <template is='dom-bind'> and add a big
      warning.
    remove curly braces from on-* event handler attributes
    detect layout attributes. Warn? Try to do the right thing?
    replace polymer-ready with web-components-ready
    warn on trackstart and trackend events
    When do we need to convert this.x = y to this._setX(y) for properties?
    Handle external stylesheets (<link rel=stylesheet>)
    elem.domMethod -> Polymer.dom(elem).domMethod:
       appendChild, insertBefore, removeChild, flush, childNodes, parentNode,
       firstChild, lastChild, firstElementChild, lastElementChild,
       previousSibling, nextSibling, textContent, innerHTML, querySelector,
       querySelectorAll, getDistributedNodes, getDestinationInsertionPoints,
       setAttribute, removeAttribute, classList
    Make a github page for polyup
    Upgrade bower.json

## Aspirational

    If there's nothing to do for a file (html or js) then leave it byte for
      byte the same.
