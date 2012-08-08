
var http = require("http");

lepote.on('message', function(from, content) {
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'def <word> : give you the <word>\'s definition.');
  }
  var that = this;
  var res = /^def\s(.+)$/.exec(content);
  if (res !== null) {
    var options = {
      host: 'www.google.com',
      port: 80,
      method: 'GET',
      path: "/search?" + require('querystring').stringify({"q": 'define:' + res[1]})
    };
    var request = http.get(options, function (response) {
      response.setEncoding("utf8");
      var buffer = '';
      response.on("data", function (chunk) {
        buffer += chunk.replace("\r", "");
      });
      response.on("end", function () {
        var definition = /\<div class="s"\>(.*)\<div\>\<cite\>en\.wikipedia\.org\/wiki/.exec(buffer);
        if (definition !== null) {
          that.push(from, res[1] + ' : ' + definition[1].replace(/(\<[^\>]+\>|\<\/[^\>]+\>|\<[^\>]+\/\>)/g, ''));
        } else {
          that.push(from, res[1] + " definition not found");
        }
      });
    });
    request.end();
  }
});
