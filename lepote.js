var xmpp = require('./lib/xmpp'),
   posix = require('posix'),
     sys = require('sys');

try {
  var lepote = new xmpp.Client();
  lepote.addListener('resources.binded', loadPlugins);

} catch (e) {
  process.stdio.writeError(e + "\n");
}

function loadPlugins () {
  posix.readdir('./plugins/').addListener('success', function (files) {
    for (var k = 0; k < files.length; ++k) {
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
  }).addListener('error', function () {
    sys.puts('[ warn ]  unable to load plugin directory');
  });
}
