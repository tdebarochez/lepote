var path = require('path')
  , fs = require('fs')
  , xmpp = require('jacasr')
  , lepote = require('../lepote')
  , bot = null;

app.get('/start', function (req, res) {
  if (bot !== null) {
    res.send('bot alreay running');
    return
  }
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<form action="/start" method="post">'
        + '<label>Login</label><input type="text" name="login" /><br />'
        + '<label>Password</label><input type="password" name="password" /><br />'
        + '<label>Domain</label><input type="text" name="domain" /><br />'
        + '<label>Port</label><input type="text" name="port" /><br />'
        + '<label>Owner JID (admin)</label><input type="text" name="owner" /><br />'
        + '<input type="submit" />'
        + '</form>');
});

app.post('/start', function (req, res) {
  if (bot === null) {
    bot = lepote.run({"login" : req.param('login'),
                      "password" : req.param('password'),
                      "domain" : req.param('domain'),
                      "port" : req.param('port')});
    bot.on('ready', function () {
      bot.admin_jid = req.param('owner');
      var plugins = lepote.plugins(bot);
      res.send('started ' + JSON.stringify(plugins));
    });
    global.bot = lepote;
  }
  else {
    res.send('already running');
  }
});

app.get('/stop', function (req, res) {
  bot.disconnect();
  bot = null;
  res.send('stoped');
});

app.get('/status', function (req, res) {
  if (bot === null) {
    res.send('bot stopped');
  }
  else {
    res.send('bot running');
  }
});