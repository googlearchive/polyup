var assert = require('assert');
var path = require('path');
var upgradeHtml = require('../lib/upgrade_html');
var fs = require('fs');


var fixturesDir = path.join(path.dirname(__filename), 'fixtures');

suite('Upgrading HTML', function() {
  var files = fs.readdirSync(fixturesDir);
  files.forEach(function(filename) {
    if (!/\.html$/.test(filename)) {
      return; // We only want the html files.
    }
    test('upgrade ' + filename, function() {
      var fullPath = path.join(fixturesDir, filename);
      var actual = upgradeHtml(fullPath);
      var expected = fs.readFileSync(fullPath + '.out', 'utf-8');
      assert.equal(expected, actual);
    });
  });
});
