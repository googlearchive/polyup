/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// Do the stupidest possible replacement of the fs module for polyup's needs
// in the browser. Used by browser_main.js and npm run browserify
var theFileName = '';
var theContents = '';

// Simulate a filesystem with exactly one file, whose contents must be specified
// ahead of time.
module.exports = {
  _setFileContents: function(filename, contents) {
    theFileName = filename;
    theContents = contents;
  },
  readFileSync: function(fileName) {
    if (fileName !== theFileName) {
      throw new Error('Could not find file ' + fileName);
    }
    return theContents;
  }
};
