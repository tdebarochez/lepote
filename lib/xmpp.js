/*
 * TODO : MD5-digest, tls, DNS SRV lookup
 */
var sys = require('sys'),
    tcp = require('tcp'),
    fs = require('fs'),
    base64 = require('./base64'),
    libxml = require('libxmljs'),
    events = require('events');

function recontext (func, that) {
  return function () {
    return func.apply(that, arguments);
  };
}

exports.Client = function (conf) {

  if (!conf) {
    var content = fs.readFileSync(process.ENV.HOME + "/.sendxmpprc");
    var match = /^([^@]+)@([^:]+):([^ ]+) (\w+)/gi.exec(content);
    conf = {login: match[1],
	    domain: match[2],
	    port: match[3],
	    password: match[4]};
  }
  if (!conf || !("login" in conf) || !conf.login || conf.login.length < 1) {
    throw "[ error ] login missing";
  }
  conf.port = conf.port || 5222;
  conf.host = conf.host || conf.domain;
  conf.status = conf.status || 'ready';
  conf.resource = conf.resource || 'LePote';

  /* Private methods */

  var setID = recontext(function (attrs) {
    this.id = attrs.id;
  }, this);
  var sasl = recontext(function (attrs) {
    this.write("<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>"
	      + base64.encode('\x00' + conf.login + '\x00' + conf.password) + "</auth>");
  }, this);
  var initiateSession = recontext(function () {
    this.write('<stream:stream to="' + conf.host + '" '
	       + 'xmlns="jabber:client" '
	       + 'xmlns:stream="http://etherx.jabber.org/streams" '
	       + 'version="1.0" >');
  }, this);
  var resourceBindings = recontext(function () {
    this.write("<iq type='set' id='bind_1'>"
	      + "<bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>" + conf.resource + "</resource>"
	      + "</bind></iq>");
    stream_events_manager.removeListener('start|bind|urn:ietf:params:xml:ns:xmpp-bind', resourceBindings);
    var sessionBindings = recontext(function () {
      this.write("<iq type='set' id='bind_2'><session xmlns='urn:ietf:params:xml:ns:xmpp-session' /></iq>");
      stream_events_manager.removeListener('start|bind|urn:ietf:params:xml:ns:xmpp-bind', sessionBindings);
      var sendPresenceInformation = recontext(function () {
	stream_events_manager.removeListener('start|session|urn:ietf:params:xml:ns:xmpp-session', sendPresenceInformation);
	this.write('<presence><show>available</show><status>' + conf.status + '</status></presence>');
      }, this);
      stream_events_manager.addListener('start|session|urn:ietf:params:xml:ns:xmpp-session', sendPresenceInformation);
    }, this);
    stream_events_manager.addListener('start|bind|urn:ietf:params:xml:ns:xmpp-bind', sessionBindings);
    this.emit('resources.binded');
  }, this);
  var onMessageReceive =  recontext(function (attrs) {
    var onMessageReceived = recontext(function (buffer) {
      stream_events_manager.removeListener('end|body|null', onMessageReceived);
      this.emit('message.receive', attrs.from, buffer, attrs.to, attrs.type, attrs.id);
    }, this);
    stream_events_manager.addListener('end|body|null', onMessageReceived);
  }, this),
  onPresenceReceive = recontext(function (attrs) {
    var status, priority = "";
    if ('type' in attrs && attrs.type == 'unavailable') {
      return;
    }
    var statusReceived = recontext(function (buffer) {
      stream_events_manager.removeListener('end|status|null', statusReceived);
      status = buffer;
    }, this),
    priorityReceived = recontext(function (buffer) {
      stream_events_manager.removeListener('end|priority|null', priorityReceived);
      priority = buffer;
    }, this),
    presenceReceived = recontext(function (buffer) {
      stream_events_manager.removeListener('end|presence|null', presenceReceived);
      this.emit('presence.receive', attrs.from, attrs.to, status, priority, attrs.type);
    }, this);
    stream_events_manager.addListener('end|presence|null', presenceReceived);
    stream_events_manager.addListener('end|priority|null', priorityReceived);
    stream_events_manager.addListener('end|status|null', statusReceived);
  }, this);
  var stream_events_manager = (new events.EventEmitter)
    .addListener('start|stream|http://etherx.jabber.org/streams', setID)
    .addListener('start|mechanisms|urn:ietf:params:xml:ns:xmpp-sasl', sasl)
    .addListener('start|success|urn:ietf:params:xml:ns:xmpp-sasl', initiateSession)
    .addListener('start|bind|urn:ietf:params:xml:ns:xmpp-bind', resourceBindings)
    .addListener('start|message|null', onMessageReceive)
    .addListener('start|presence|null', onPresenceReceive);
  var xml_parser = new libxml.SaxParser(function(cb) {
    cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
      xml_parser.current_elem = elem;
      if (!xml_parser.buffer) {
        xml_parser.buffer = {};
      }
      xml_parser.buffer[elem] = '';
      if (stream_events_manager.listeners('start|' + elem+ '|' + uri).length > 0) {
	var params = {};
        for (var i = 0, l = attrs.length; i < l; ++i) {
	  params[attrs[i][0]] = attrs[i][3];
	}
	stream_events_manager.emit('start|' + elem+ '|' + uri, params);
      }
    });
    cb.onEndElementNS(function(elem, prefix, uri) {
      stream_events_manager.emit('end|' + elem+ '|' + uri, [xml_parser.buffer[elem]]);

    });
    cb.onCharacters(function (chars) {
      xml_parser.buffer[xml_parser.current_elem] += chars;
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
      this.setEncoding("utf8");
      initiateSession.apply(this);
    })
    .addListener("data", function (data) {
      //sys.puts('[ rcv ] ' + data);
      xml_parser.parseString(data);
    })
    .addListener("close", function (had_error) {
      if (had_error) {
        throw 'connection close with error';
      }
    })
    .addListener("end", function () {
      this.write('</stream:stream>');
      sys.puts('[ eof ] ');
    });

  /* Public methods */

  this.id = 0;
  this.push = function (to, str) {
    var raw = '<message from="' + conf.login + '@' + conf.domain + '/' + conf.resource + '" '
              + 'to="' + to +'" type="chat"><body>' + str + '</body></message>';
    //sys.puts('[ send ] ' + raw);
    this.write(raw);
    this.emit('message.sent', to, str);
  };

  this.subscribe = function (to, group, name) {
    group = group || 'Group';
    name = name || to;
    var raw = '<iq type="set" id="set2">'
                + '  <query xmlns="jabber:iq:roster">'
                + '    <item'
                + '        jid="' + to + '"'
                + '        name="'+ name +'">'
                + '      <group>' + group + '</group>'
                + '    </item>'
                + '  </query>'
                + '</iq>'
                + '<presence to="'+ to +'" type="subscribed" />';
    this.write(raw);
  };
  this.write = function (data) {
    conn.write(data);
  };
};

process.mixin(exports.Client, events.EventEmitter);

