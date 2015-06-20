// The browserify entrance for the script. Exports upgradeHtml as a global.
var upgradeHtml = require('./upgrade_html');
var fs = require('fs'); // Note, this is a fake. See build/fake-fs.js

window.upgradeHtml = function(htmlString) {
  fs._setFileContents('/foo.html', htmlString);
  return upgradeHtml('/foo.html')['/foo.html'];
};
