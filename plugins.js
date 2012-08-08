var fs  = require('fs');

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

require('./lepote');
fs.readdir(dir, function (err, files) {
  if (err) {
    console.warn('[ warn ] unable to load plugin directory');
    return;
  }
  lepote.setMaxListeners(files.length * 2 + 10);
  for (var k = 0, l = files.length; k < l; ++k) {
    if (!(/\.js$/.exec(files[k]))) {
      continue;
    }
    var filename = dir + files[k];
    require(filename.replace(/(\.js)$/, ''));
    console.log('[ load ] ' + filename);
  }
});