var sys = require('sys'),
http = require("http");
exports.events = [function() {
  this.addListener('message.receive', function(from, content, to, type, id) {
    var that = this;
    var res = /^weather\s(.+)$/.exec(content);
    if (res !== null) {
      var google = http.createClient(80, "www.google.com");
      var query = "/ig/api?"+require('querystring').stringify({weather: res[1], hl: 'en'});
      var request = google.request("GET", query, {"host": "www.google.com"});
      request.addListener('response', function (response) {
	response.setBodyEncoding("utf8");
	var buffer = '';
	response.addListener("data", function (chunk) {
	  buffer += chunk;
	});
	response.addListener("end", function () {
	var condition = /\<current_conditions\s*\>.*\<condition\s+data="([^"]+)"\s*\/\>.*\<temp_c\s+data="([^"]+)"\s*\/\>.*\<humidity\s+data="([^"]+)"\s*\/\>.*\<\/current_conditions\>/.exec(buffer);
	that.push(from, condition[1] + ', ' + condition[2] + 'C, ' + condition[3]);
	  });
	});
      request.close();
    }
  });
}];