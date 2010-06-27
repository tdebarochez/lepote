var sys = require('sys'),
    fs  = require('fs');

/**
 * == Plugins ==
 * Plugins are placed in `plugins/` directory and automatically include.
 *
 * ##### Usage
 *
 * Example of usage :
 *
 *     exports.events = [function () {
 *       this.addListener('message.receive', function(from, content, to, type, id) {
 *         if (/^ping$/.exec(content)) {
 *           this.push(from, 'pong');
 *         }
 *       });
 *     ];
 **/

/** section: Plugins
 * load([dir]) -> null
 * - dir (String): plugins directory (default: "./plugins/")
 *
 * Load plugins
 **/


function load (dir) {
  dir = dir || './plugins/';
  var lepote = this;
  fs.readdir(dir, function (err, files) {
    if (err) {
      sys.puts('[ warn ]  unable to load plugin directory');
      return;
    }
    for (var k = 0, l = files.length; k < l; ++k) {
      if (!(/\.js$/.exec(files[k]))) {
        continue;
      }
      var filename = dir + files[k];
      require(filename.replace(/(\.js)$/, '')).events.forEach(function (func) {
        func.apply(lepote);
      });
      sys.puts('[ load ] ' + filename);
    }
  });
}

exports.load = load;