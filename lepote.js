var xmpp = require('./lib/xmpp'),
      fs = require('fs'),
     sys = require('sys');

try {
  var lepote = new xmpp.Client();
  lepote.addListener('resources.binded', loadPlugins);

} catch (e) {
  process.stdio.writeError(e + "\n");
}

function loadPlugins () {
  fs.readdir('./plugins/', function (err, files) {
    if (err) {
      sys.puts('[ warn ]  unable to load plugin directory');
      return;
    }
    for (var k = 0, l = files.length; k < l; ++k) {
      if (!(/\.js$/.exec(files[k]))) {
        continue;
      }
      var filename = './plugins/' + files[k];
      var plugin = require(filename.replace(/(\.js)$/, ''));
      for (var j = 0; j < plugin.listeners.length; ++j) {
	lepote.addListener(plugin.listeners[j].event, plugin.listeners[j].func);
      }
      sys.puts('[ load ] ' + filename + ' ' + plugin.listeners.length + ' listeners');
    }
  });
}
