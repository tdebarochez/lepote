var xmpp = require('./lib/xmpp');

try {
  var lepote = new xmpp.Client({login: 'test',
				password: 'test',
				domain: 'localhost',
				host: 'localhost',
				port: 5222,
				resource: 'LePote',
				status: 'Au rapport, Sir !'});
} catch (e) {
  process.stdio.writeError(e + "\n");
}