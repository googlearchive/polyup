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

require("babel/polyfill");
import upgradeHtml from './upgrade_html';
import nomnomLib from 'nomnom';
import colors from 'colors/safe';
import fs from 'fs';
import path from 'path';

const nomnom = nomnomLib();
nomnom.script('polyup');
nomnom.option('overwrite', {
  flag: true,
  help: 'Overwrite the input html and any referenced scripts on disk.'
});
nomnom.option('ignore', {
  abbr: 'i',
  list: true,
  metavar: 'PATH',
  default: [],
  help: 'File(s) that polyup should not upgrade, or even try to read at all. ' +
        ' Can be specified multiple times.'
});
nomnom.option('webserver_root', {
  metavar: 'PATH',
  help: 'Base directory for resolving absolute URL paths.'
});
nomnom.option('http_path_to_components', {
  metavar: 'PATH',
  help: 'Absolute site-local URL base for components. Used when polyup needs ' +
      'to insert HTML imports. If not given, polyup will attempt to infer ' +
      'it from other imports.'
});
nomnom.option('path_to_html', {
  position: 0,
  required: true,
  help: 'Path to the HTML file to upgrade. The first positional argument.'
});
const opts = nomnom.parse();

const filename = opts.path_to_html;
if (!fs.existsSync(filename)) {
  console.error('No such file: ' + filename);
  process.exit(66);
}

const toIgnore = new Set();
opts.ignore.forEach(function(toIgnore) {
  toIgnore = path.resolve(toIgnore);
  if (!fs.existsSync(toIgnore)) {
    console.error(`Ignored file doesn't exists at \`${toIgnore}\``);
    process.exit(66);
  }
  toIgnore.add(toIgnore);
});

const componentsPath = opts.http_path_to_components;

let webserverRoot;
if (opts.webserver_root) {
  webserverRoot = path.resolve(opts.webserver_root);
  let stat;
  try {
    stat = fs.statSync(webserverRoot);
  } catch (_) { /* ignore */}
  if (!stat || !stat.isDirectory()) {
    console.error(`No directory at webserver_root path \`${webserverRoot}\``);
    process.exit(66);
  }
}

let outputMap;
try {
  outputMap = upgradeHtml(filename, {toIgnore, webserverRoot, componentsPath});
} catch(e) {
  console.error('Error attempting to upgrade ' + filename + '\n\n');
  throw e;
}

if (!opts.overwrite) {
  if (Object.keys(outputMap).length === 0) {
    console.log('No changes needed.');
  }

  console.log();
  for (let outFile in outputMap) {
    const contents = outputMap[outFile];
    console.log(colors.blue(outFile));
    for (let line of contents.split('\n')) {
      console.log(`  ${line}`);
    }
  }
} else {
  const tempPaths = {};
  const cwd = process.cwd();
  for (let outFile in outputMap) {
    if (!outFile.startsWith(cwd)) {
      if (webserverRoot) {
        if (!outFile.startsWith(webserverRoot)) {
          console.error(
            'For safety polyup will only modify files under your ' +
            'current working directory or the webserver root.');
          console.error(`This file is outside both: ${outFile}'`);
          process.exit(78);
        }
        continue;
      }
      console.error(
          'For safety polyup will only modify files under your ' +
          'current working directory.');
      console.error(`This file is outside your cwd: ${outFile}'`);
      process.exit(78);
    }
  }
  for (let outFile in outputMap) {
    // Put temp dirs in the same directory, to be confident that they'll be
    // in the same filesystem, and thus more likely for the moves to be atomic.
    let targetDir = path.dirname(outFile);
    let tempFilename;
    do {
      tempFilename = path.join(targetDir, '.polyup_temp_' + Math.random());
    } while(fs.existsSync(tempFilename));
    tempPaths[outFile] = tempFilename;
    fs.writeFileSync(tempFilename, outputMap[outFile]);
  }
  // Now that we've written all of the data out to disk we can just do move
  // operations, which should be atomic on most systems.
  for (let outFile in outputMap) {
    fs.renameSync(tempPaths[outFile], outFile);
  }
}
