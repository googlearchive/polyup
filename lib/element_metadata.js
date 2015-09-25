export default class ElementMetadata {
  constructor(name) {
    this.name = name;
    this.attrs = {};
    this.hostAttrs = {};
    this.listeners = {};
    this.behaviors = [];
    this.newDeclarations = new Set();
    this.polyfillTokenList = false;
  }

  getAttr(name) {
    if (!this.attrs[name]) {
      this.attrs[name] = {name: name};
    }
    return this.attrs[name];
  }
}
