#!/usr/bin/env node


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

var upgradeHtml = require('./upgrade_html');
var nomnom = require('nomnom')();
var colors = require('colors/safe');
var fs = require('fs');
var path = require('path');
var es6Collections = require('es6-collections');
// jshint -W079
var Set = es6Collections.Set || global.Set;
// jshint +W079

nomnom.script('polyup');
nomnom.option('overwrite', {
  flag: true,
  help: 'Overwrite the input html and any referenced scripts on disk.'
});
nomnom.option('ignore', {
  abbr: 'i',
  list: true,
  metavar: 'PATH',
  'default': [],
  help: 'File(s) that polyup should not upgrade, or even try to read at all. ' + ' Can be specified multiple times.'
});
nomnom.option('path_to_html', {
  position: 0,
  required: true,
  help: 'Path to the HTML file to upgrade. The first positional argument.'
});
var opts = nomnom.parse();

var filename = opts.path_to_html;
if (!fs.existsSync(filename)) {
  console.error('No such file: ' + filename);
  process.exit(66);
}

var toIgnore = new Set();
opts.ignore.forEach(function (toIgnore) {
  toIgnore = path.resolve(toIgnore);
  if (!fs.existsSync(toIgnore)) {
    console.error('No file exists at path `' + toIgnore + '`');
    process.exit(66);
  }
  toIgnore.add(toIgnore);
});

var outputMap;
try {
  outputMap = upgradeHtml(filename, { toIgnore: toIgnore });
} catch (e) {
  console.error('Error attempting to upgrade ' + filename + '\n\n');
  throw e;
}

if (!opts.overwrite) {
  console.log();
  for (var filename in outputMap) {
    var contents = outputMap[filename];
    console.log(colors.blue(filename));
    var lines = contents.split('\n');
    for (var i = 0; i < lines.length; i++) {
      console.log('  ' + lines[i]);
    }
  }
} else {
  var tempPaths = {};
  var cwd = process.cwd();
  for (var filename in outputMap) {
    if (filename.substring(0, cwd.length) !== cwd) {
      console.error('For safety polyup will only modify files under your ' + 'current working directory.');
      console.error('This file is outside your cwd: ' + filename);
      process.exit(78);
    }
  }
  for (var filename in outputMap) {
    // Put temp dirs in the same directory, to be confident that they'll be
    // in the same filesystem, and thus more likely for the moves to be atomic.
    var targetDir = path.dirname(filename);
    var tempFilename;
    do {
      tempFilename = path.join(targetDir, '.polyup_temp_' + Math.random());
    } while (fs.existsSync(tempFilename));
    tempPaths[filename] = tempFilename;
    fs.writeFileSync(tempFilename, outputMap[filename]);
  }
  // Now that we've written all of the data out to disk we can just do move
  // operations, which should be atomic on most systems.
  for (filename in outputMap) {
    tempFilename = tempPaths[filename];
    fs.renameSync(tempFilename, filename);
  }
}
