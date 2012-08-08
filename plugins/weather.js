var http = require('http');

lepote.on('message', function(from, content) {
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'weather <place> : give you the current weather state at <place>.');
  }
  var that = this;
  var res = /^weather\s(.+)$/.exec(content);
  if (res === null) {
    return;
  }
  var options = {
    host: 'www.google.com',
    port: 80,
    method: 'GET',
    path: "/ig/api?"+require('querystring').stringify({"weather": res[1], "hl": 'en'})
  };
  var request = http.get(options, function (response) {
    response.setEncoding("utf8");
    var buffer = '';
    response.on("data", function (chunk) {
      buffer += chunk;
    });
    response.on("end", function () {
      var condition = /\<current_conditions\s*\>.*\<condition\s+data="([^"]+)"\s*\/\>.*\<temp_c\s+data="([^"]+)"\s*\/\>.*\<humidity\s+data="([^"]+)"\s*\/\>.*\<\/current_conditions\>/.exec(buffer);
      that.push(from, condition[1] + ', ' + condition[2] + 'C, ' + condition[3]);
    });
  });
  request.end();
});
