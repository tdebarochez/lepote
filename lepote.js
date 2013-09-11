var xmpp = require('jacasr')
  , path = require('path')
  , path = require('path')
  , fs = require('fs');

function run (conf) {
  var lepote = new xmpp.Client(conf);

  lepote.on('ready', function () {
    setTimeout(function () {
      fs.readFile(path.join(__dirname, 'opts', 'bender.vcard.xml'), function (err, content) {
        if (err) throw err;
        return;
        lepote.setVcard(content);
        lepote.setStatus('chat', 'ready to chat', 25, '4bd204bc354262b758d81ff803ebcb8b91674806'); // sha1 of opts/avatar.png
      })
    }, 2000);
  });
  return lepote;
}

function plugins (lepote) {
  global.lepote = lepote;
  global.xmpp = xmpp;
  var dir = 'plugins';
  var plugins = [];
  fs.readdirSync(path.join(__dirname, dir)).forEach(function(file){
    if (false === /\.js$/.exec(file)) {
      return;
    }
    var filename = path.join(dir, file);
    require('./' + filename);
    console.log('[ load ] ' + filename);
    plugins.push(file);
  });
  return plugins;
}

if (null === module.parent) {
  var lepote = run();
  lepote.on('ready', function () {
    plugins(lepote);
  });
}

exports.run = run;
exports.plugins = plugins;