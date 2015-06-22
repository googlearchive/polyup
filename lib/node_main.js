#!/usr/bin/env node

'use strict';

var upgradeHtml = require('./upgrade_html');
var yargs = require('yargs');
var colors = require('colors/safe');
var fs = require('fs');
var path = require('path');

var argv = yargs
    .usage(
      'polyup [options] ./path/to/your/v0.5/source.html\n\n' +

      'Assists in upgrading code that uses Polymer from v0.5 to v1.0. Takes ' +
      'care of most of the purely mechanical steps automatically.\n\n' +

      'By default, running polyup simply prints the upgraded code to the ' +
      'console. You must use the --overwrite option for anything to actually ' +
      'be written to disk.')
    .demand(1)
    .help('help')
    .boolean('overwrite')
    .describe(
      'overwrite',
      'Overwrite the input html and any referenced scripts on disk. ' +
      'Warning! Be confident that your source control is in a good state ' +
      'before you override your source code!')
    .argv;

var filename = argv._[0];
if (!fs.existsSync(filename)) {
  console.error('No such file: ' + filename);
  process.exit(1);
}

var outputMap;
try {
  outputMap = upgradeHtml(filename);
} catch(e) {
  console.error('Error attempting to upgrade ' + filename + '\n\n');
  throw e;
}

if (!argv.overwrite) {
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
  for (var filename in outputMap) {
    // Put temp dirs in the same directory, to be confident that they'll be
    // in the same filesystem, and thus more likely for the moves to be atomic.
    var targetDir = path.dirname(filename);
    var tempFilename;
    do {
      tempFilename = path.join(targetDir, '.polyup_temp_' + Math.random());
    } while(fs.existsSync(tempFilename));
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
