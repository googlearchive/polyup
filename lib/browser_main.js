window._fs = {};
var upgradeHtml = require('./upgrade_html');


var theFileName = '';
var theFile = '';
window._fs.readFileSync = function(fileName) {
  if (fileName !== theFileName) {
    throw new Error('Could not find file ' + fileName);
  }
  return theFile;
}


window.upgradeHtml = function(htmlString) {
  theFileName = '/foo.html';
  theFile = htmlString;
  return upgradeHtml('/foo.html')['/foo.html'];
}
