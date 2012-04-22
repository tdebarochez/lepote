var sys = require('util')
  , http = require("http");
exports.events = [function() {
  this.addListener('message.receive', function(from, content) {
    if (content.substr(0, 4) === 'help') {
      return this.push(from, 'def <word> : give you the <word>\'s definition.');
    }
    var that = this;
    var res = /^def\s(.+)$/.exec(content);
    if (res !== null) {
      var google = http.createClient(80, "www.google.com");
      var query = "/search?"+require('querystring').stringify({q: 'define:'+res[1]});
      var request = google.request("GET", query, {"host": "www.google.com"});
      request.addListener('response', function (response) {
        response.setEncoding("utf8");
        var buffer = '';
        response.addListener("data", function (chunk) {
          buffer += chunk.replace("\r", "");
        });
        response.addListener("end", function () {
          var definition = /\<li\>([^\<]+)\<br\>\<a href="\/url\?q=(http:\/\/en.wikipedia.org\/wiki\/[^&]+)&/.exec(buffer);
          if (definition !== null) {
            that.push(from, definition[1]+' '+definition[2]);
          } else {
            that.push(from, res[1] + " definition not found");
          }
        });
      });
      request.end();
    }
  });
}];