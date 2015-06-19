window._fs = {};
var upgradeHtml = require('./upgrade_html');

// Patch over the fs node module, which our fake_fs transform will replace
// all require('fs') calls with window._fs.
var theFileName = '';
var theFile = '';
window._fs.readFileSync = function(fileName) {
  if (fileName !== theFileName) {
    throw new Error('Could not find file ' + fileName);
  }
  return theFile;
};

window.upgradeHtml = function(htmlString) {
  theFileName = '/foo.html';
  theFile = htmlString;
  return upgradeHtml('/foo.html')['/foo.html'];
};
