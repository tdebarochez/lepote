var http = require('http'),
    sys = require('util'),
    querystring = require('querystring');

var that;
http.createServer(function(request, response) {
  var body = '';
  request.addListener('data', function(chunk) {
    body = body + chunk;
  });
  request.addListener('end', function() {
    var params = JSON.parse(querystring.parse(body).payload);
    response.writeHead(200, {"content-length":"message",
			                       "content-type":"text/plain"});
    response.end('thx !');
    var authors = [];
    params.commits.forEach(function (commit) {
      if (authors.join().indexOf(commit.author.name) == -1) {
        authors.push(commit.author.name);
      }
    });
    that.push('john.doe@example.com', params.commits.length + ' commits has just been pushed on ' + params.repository.name + ' repository by : ' + authors.join(', '));
  });
}).listen(8123);

//exports.events = [function() { that = this; }];
exports.events = [];