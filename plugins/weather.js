var sys = require('util')
  , http = require("http");
exports.events = [function() {
  this.addListener('message.receive', function(from, content) {
    if (content.substr(0, 4) === 'help') {
      return this.push(from, 'weather <place> : give you the current weather state at <place>.');
    }
    var that = this;
    var res = /^weather\s(.+)$/.exec(content);
    if (res !== null) {
      var google = http.createClient(80, "www.google.com");
      var query = "/ig/api?"+require('querystring').stringify({weather: res[1], hl: 'en'});
      var request = google.request("GET", query, {"host": "www.google.com"});
      request.addListener('response', function (response) {
        response.setEncoding("utf8");
        var buffer = '';
        response.addListener("data", function (chunk) {
          buffer += chunk;
        });
        response.addListener("end", function () {
          var condition = /\<current_conditions\s*\>.*\<condition\s+data="([^"]+)"\s*\/\>.*\<temp_c\s+data="([^"]+)"\s*\/\>.*\<humidity\s+data="([^"]+)"\s*\/\>.*\<\/current_conditions\>/.exec(buffer);
          that.push(from, condition[1] + ', ' + condition[2] + 'C, ' + condition[3]);
        });
      });
      request.end();
    }
  });
}];