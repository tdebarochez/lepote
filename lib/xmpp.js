/*
 * TODO : MD5-digest, tls, sendxmpp rc
 */
var sys = require('sys'),
    tcp = require('tcp'),
    posix = require('posix'),
    base64 = require('./base64'),
    libxml = require('libxmljs');

exports.Client = function (conf) {
  var client = this;
  this.id = 0;
  this.emitter = process.EventEmitter();
  var setID = function (attrs) {
    client.id = attrs.id;
  };
  this.push = function (to, str) {
      var raw = '<message from="' + conf.login + '@' + conf.domain + '/' + conf.resource + '" '
                + 'to="' + to +'" type="chat"><body>' + str + '</body></message>';
      sys.puts('[ send ] ' + raw);
      conn.send(raw);
  };
  this.reloadPlugins = function () {
    posix.readdir('./lib/plugins/').addListener('success', function (files) {
      for (var k = 0; k < files.length; ++k) {
        if (!(/\.js$/.exec(files[k]))) {
          continue;
        }
        var filename = './plugins/' + files[k];
        var plugin = require(filename.replace(/(\.js)$/, ''));
        for (var j = 0; j < plugin.listeners.length; ++j) {
          client.emitter.removeListener(plugin.listeners[j].event, plugin.listeners[j].func);
          client.emitter.addListener(plugin.listeners[j].event, plugin.listeners[j].func);
        }
	sys.puts('[ load ] ' + filename + ' ' + plugin.listeners.length + ' listeners');
      }
    }).addListener('error', function () {
      sys.puts('[ warn ]  unable to load plugin directory');
    });
  };
  var sasl = function (attrs) {
    this.send("<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>"
	      + base64.encode('\x00' + conf.login + '\x00' + conf.password) + "</auth>");
  };
  var initiateSession = function () {
      this.send('<stream:stream to="' + conf.host + '" '
		+ 'xmlns="jabber:client" '
		+ 'xmlns:stream="http://etherx.jabber.org/streams" '
		+ 'version="1.0" >');
  };
  var resourceBindings = function () {
    this.send("<iq type='set' id='bind_1'>"
	      + "<bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>" + conf.resource + "</resource>"
	      + "</bind></iq>");
    delete bindsHandlersStart['bind|urn:ietf:params:xml:ns:xmpp-bind'];
    bindsHandlersStart['bind|urn:ietf:params:xml:ns:xmpp-bind'] = function () {
      this.send("<iq type='set' id='bind_2'><session xmlns='urn:ietf:params:xml:ns:xmpp-session' /></iq>");
      delete  bindsHandlersStart['bind|urn:ietf:params:xml:ns:xmpp-bind'];
      bindsHandlersStart['session|urn:ietf:params:xml:ns:xmpp-session'] = function () {
	delete bindsHandlersStart['session|urn:ietf:params:xml:ns:xmpp-session'];
	this.send('<presence><show>available</show><status>' + conf.status + '</status></presence>');
      };
    };
    client.reloadPlugins();
  };
  var onMessageReceive = function (attrs) {
    bindsHandlersEnd['body|null'] = function (buffer) {
      delete bindsHandlersEnd['body|null'];
      client.emitter.emit('message.receive', client, attrs.from, buffer, attrs.to, attrs.type, attrs.id);
    };
  };
  var bindsHandlersStart = {'stream|http://etherx.jabber.org/streams': setID,
			     'mechanisms|urn:ietf:params:xml:ns:xmpp-sasl': sasl,
 			     'success|urn:ietf:params:xml:ns:xmpp-sasl': initiateSession,
                             'bind|urn:ietf:params:xml:ns:xmpp-bind': resourceBindings,
                             'message|null': onMessageReceive};
  var bindsHandlersEnd = {};
  var parser = new libxml.SaxParser(function(cb) {
    cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
      parser.current_elem = elem;
      if (!parser.buffer) {
        parser.buffer = {};
      }
      parser.buffer[elem] = '';
      if ((elem+ '|' + uri) in bindsHandlersStart
          && typeof bindsHandlersStart[(elem+ '|' + uri)] == 'function') {
	var params = {};
        for (var i = 0, l = attrs.length; i < l; ++i) {
	  params[attrs[i][0]] = attrs[i][3];
	}
        bindsHandlersStart[(elem+ '|' + uri)].apply(conn, [params]);
      }
    });
    cb.onEndElementNS(function(elem, prefix, uri) {
      if ((elem+ '|' + uri) in bindsHandlersEnd
         && typeof bindsHandlersEnd[(elem+ '|' + uri)] == 'function') {
        bindsHandlersEnd[(elem+ '|' + uri)].apply(conn, [parser.buffer[elem]]);
      }
    });
    cb.onCharacters(function (chars) {
      parser.buffer[parser.current_elem] += chars;
    });
  });
  var conn = tcp.createConnection(conf.port, conf.host)
    .addListener("disconnect", function (hadError) {
      if (hadError) {
	throw "disconnected server in error";
      }
    })
    .addListener("connect", function () {
      this.setTimeout(0);
      sys.puts('[ connect ] ');
//      this.setSecure("X509_PEM");
//      sys.puts('[ use TLS ] ');
      this.send('<stream:stream to="' + conf.domain + '" '
		+ 'xmlns="jabber:client" '
		+ 'xmlns:stream="http://etherx.jabber.org/streams" '
		+ 'version="1.0">');
    })
    .addListener("receive", function (data) {
      sys.puts('[ rcv ] ' + data);
      parser.parseString(data);
    })
    .addListener("close", function (had_error) {
      if (had_error) {
        throw 'connection close with error';
      }
    })
    .addListener("eof", function () {
      this.send('</stream:stream>');
      sys.puts('[ eof ] ');
    });
};

try {
  tcp.createServer().setSecure();
} catch (e) {
  process.stdio.writeError("Not compiled with TLS support.\n");
  process.exit();
}

