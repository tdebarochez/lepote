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
      require(filename.replace(/(\.js)$/, '')).events.forEach(function (func) {
        func.apply(lepote);
      });
      sys.puts('[ load ] ' + filename);
    }
  });
}
