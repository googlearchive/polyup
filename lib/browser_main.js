/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// The browserify entrance for the script. Exports upgradeHtml as a global.
require("babel/polyfill");
var upgradeHtml = require('./upgrade_html');
var fs = require('fs'); // Note, this is a fake. See build/fake-fs.js

window.Polyup = {
  upgradeHtml: function(htmlString) {
    fs._setFileContents('/foo.html', htmlString);
    return upgradeHtml('/foo.html')['/foo.html'];
  }
};
