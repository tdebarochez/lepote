var xmpp = require('./lib/xmpp')
  , plugins = require('./plugins');

try {

  var lepote = new xmpp.Client();
  lepote.addListener('resources.binded', plugins.load);

}
catch (e) {
  require('sys').puts(e + "\n");
}
