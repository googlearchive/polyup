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
