var http = require('http');

lepote.on('message', function(from, content) {
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'weather <city>, <country> : give you the current weather state at <city>.');
  }
  var that = this;
  var res = /^weather\s([^,]+),\s+(.*)$/.exec(content);
  if (res === null) {
    return;
  }
  //http://api.wunderground.com/api/1e124db77eef6c84/geolookup/conditions/q/FR/Paris.json
  var options = {
    host: 'api.wunderground.com',
    port: 80,
    method: 'GET',
    path: "/api/1e124db77eef6c84/geolookup/conditions/q/" + res[2] + '/' + res[1] + '.json'
  };
  var request = http.get(options, function (response) {
    if (response.statusCode !== 200) {
      that.push(from, res[1] + ' not found');
      return;
    }
    response.setEncoding("utf8");
    var buffer = '';
    response.on("data", function (chunk) {
      buffer += chunk;
    });
    response.on("end", function () {
      var current = JSON.parse(buffer).current_observation;
      that.push(from, res[1] + ' : ' + current.temperature_string + ', humidity : ' + current.relative_humidity);
    });
  });
  request.end();
});
