'use strict';

var nodeStatic = require('node-static');
var path = require('path');
var mime = require('mime');
var fs = require('fs');

var baseDir = path.resolve(path.dirname(__filename));
var fileServer = new nodeStatic.Server(baseDir, {cache: false});

function getFileName(reqPath) {
  var match = reqPath.match(/\/$/);
  if (match) {
    reqPath += 'index.html';
  }
  var match = reqPath.match(/^\/0.5\/components\/(.*)/);
  if (match) {
    return 'test/bower_0.5/bower_components/' + match[1];
  }
  match = reqPath.match(/^\/1.0\/components\/(.*)/);
  if (match) {
    return 'test/bower_1.0/bower_components/' + match[1];
  }
  match = reqPath.match(/^\/0.5\/(.*)/);
  if (match) {
    return 'test/fixtures/' + match[1];
  }
  match = reqPath.match(/^\/1.0\/(.*)/);
  if (match) {
    return 'test/fixtures/' + match[1] + '.out';
  }
  match = reqPath.match(/^\/dist\/(.*)/);
  if (match) {
    return 'dist/' + match[1];
  }
  match = reqPath.match(/^\/components\/(.*)/);
  if (match) {
    return 'bower_components/' + match[1];
  }
  return 'web' + reqPath;
}

var pathsThatShouldExist = [
    'test/bower_0.5/bower_components/polymer/polymer.html',
    'test/bower_1.0/bower_components/polymer/polymer.html'
];
pathsThatShouldExist.forEach(function(filename) {
  filename = path.join(baseDir, filename);
  try {
    fs.statSync(filename);
  } catch(_ignored) {
    console.error(
        'Error: You must run `bower install` in both test/bower_0.5 and ' +
        'test/bower_1.0\nThat way the fixtures can find their ' +
        'external dependencies.');
    process.exit(1);
  }
});

require('http').createServer(function(request, response) {
  request.addListener('end', function() {
    var fileToServe = getFileName(request.url);
    var headers = {};
    var match = fileToServe.match(/^(.*)\.out$/);
    if (match) {
      headers['Content-Type'] = mime.lookup(match[1]);
    }
    fileServer.serveFile(fileToServe, 200, headers, request, response)
        .on('error', function() {
          response.statusCode = 404;
          response.end();
        });
  }).resume();
}).listen(8000);

console.log('Listening on http://localhost:8000/');
