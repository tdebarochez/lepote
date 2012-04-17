var xmpp = require('./lib/xmpp')
  , plugins = require('./plugins')
  , http = require('http')
  , url = require('url')
  , querystring = require('querystring')
  , bot = null;

try {

  var server = http.createServer(function (req, res) {
    var params = url.parse(req.url, true);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    switch (params.pathname.substr(1)) {
      case 'start':
        if (bot === null) {
          bot = new xmpp.Client({"login" : params.query.login,
                                 "password" : params.query.password,
                                 "domain" : params.query.domain,
                                 "port" : params.query.port});
          bot.addListener('resources.binded', plugins.load);
          res.end('started');
        }
        else {
          res.end('already running');
        }
        break;
      case 'stop':
        bot.disconnect();
        bot = null;
        res.end('stoped');
        break;
      case 'status':
        if (bot === null) {
          res.end('bot stopped');
        }
        else {
          res.end('bot running');
        }
        break;
      case 'webhook':
        if (bot !== null) {
          var body = '';
          req.addListener('data', function(chunk) {
            body = body + chunk;
          });
          req.addListener('end', function() {
            res.end('thx !');
            try {
              var params = JSON.parse(querystring.parse(body).payload);
            }
            catch (e) {
              console.error(querystring.parse(body));
              console.error(e);
              return;
            }
            var authors = [];
            params.commits.forEach(function (commit) {
              if (authors.join().indexOf(commit.author.name) == -1) {
                authors.push(commit.author.name);
              }
            });
            bot.push('thomas.barochez@gmail.com', params.commits.length + ' commits has just been pushed on ' + params.repository.name + ' repository by : ' + authors.join(', '));
          });
        }
        break;
      default:
        res.end('nothing to see here');
    }
  }).listen(process.env['app_port'] || 3000);

}
catch (e) {
  require('util').puts(e + "\n");
}
