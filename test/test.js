/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

var assert = require('assert');
var path = require('path');
var upgradeHtml = require('../dist/upgrade_html');
var fs = require('fs');


var fixturesDir = path.join(path.dirname(__filename), 'fixtures');
var outputFilesAssertedOn = new Set();

suite('Upgrading HTML', function() {
  var files = fs.readdirSync(fixturesDir);
  var skipped = new Set([
    // While developing new and complex tests where the work needed to get them
    // to pass is more than one commit, first check them in (including
    // the desired .out file) and add the filename of the input fixture to this
    // list.
  ]);
  files.forEach(function(filename) {
    if (!/\.html$/.test(filename)) {
      return; // We only want the html files.
    }
    if (skipped.has(filename)) {
      return;
    }
    test('upgrade ' + filename, function() {
      var fullPath = path.join(fixturesDir, filename);
      var filemapping = upgradeHtml(fullPath);
      for (var resultFilename in filemapping) {
        outputFilesAssertedOn.add(resultFilename + '.out');
        var expectedOutput = fs.readFileSync(resultFilename + '.out', 'utf-8');
        var actualOutput = filemapping[resultFilename];
        assert.equal(actualOutput, expectedOutput);
      }
    });
  });
  after(function() {
    var outputFiles = files.filter(
        function(filename) { return /\.out$/.test(filename); });
    var unassertedFiles = [];
    outputFiles.forEach(function(outfile) {
      outfile = path.resolve(fixturesDir, outfile);
      if (!outputFilesAssertedOn.has(outfile)) {
        unassertedFiles.push(path.basename(outfile));
      }
    });
    unassertedFiles = unassertedFiles.filter(function(filename) {
      return !skipped.has(filename.substring(0, filename.length - 4));
    });
    if (unassertedFiles.length !== 0) {
      throw new Error(
            'No assertions made about the fixture output file ' +
            JSON.stringify(unassertedFiles));
    }
  });
});
