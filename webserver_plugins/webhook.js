var url = require('url')
  , querystring = require('querystring');

app.get('/webhook', function (req, res) {
  if (bot === null || typeof bot.admin_jid === "undefined") {
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  var body = '';
  req.on('data', function(chunk) {
    body = body + chunk;
  });
  req.on('end', function() {
    res.end('thx !');
    try {
      var params = JSON.parse(body);
    }
    catch (e) {
      console.error(body);
      console.error(e);
      return;
    }
    var authors = [];
    params.commits.forEach(function (commit) {
      if (authors.join().indexOf(commit.author.name) == -1) {
        authors.push(commit.author.name);
      }
    });
    bot.push(bot.admin_jid, params.commits.length + ' commits has just been pushed on ' + params.repository.name + '/' + params.ref + ' repository by : ' + authors.join(', '));
  });
});