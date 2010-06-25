/*
 * TODO : tls
 */
var sys    = require('sys'),
    tcp    = require('net'),
    fs     = require('fs'),
    events = require('events'),
    dns    = require('dns'),
    libxml = require('libxmljs'),
    base64 = require('../deps/node-base64.js/base64'),
    md5dig = require('./md5-digest');

function recontext (func, that) {
  return function () {
    return func.apply(that, arguments);
  };
}

var NS_SASL = 'urn:ietf:params:xml:ns:xmpp-sasl',
NS_BIND = 'urn:ietf:params:xml:ns:xmpp-bind',
NS_SESSION = 'urn:ietf:params:xml:ns:xmpp-session',
NS_CLIENT = 'jabber:client',
NS_XHTML = 'http://www.w3.org/1999/xhtml',
NS_XHTML_IM = 'http://jabber.org/protocol/xhtml-im',
NS_TLS = 'urn:ietf:params:xml:ns:xmpp-tls',
NS_STREAMS = 'http://etherx.jabber.org/streams',
NS_ROASTER = 'jabber:iq:roster',
NS_VCARD = 'vcard-temp',
Client = function (conf) {
  /* Private methods */

  var setID = recontext(function (attrs) {
    this.id = attrs.id;
  }, this);
  var sasl = recontext(function (attrs) {
    stream_events_manager.removeListener('end|mechanism|' + NS_SASL, setMechanism);
    if (mechanisms.indexOf('DIGEST-MD5')) {
      this.write("<auth xmlns='" + NS_SASL + "' mechanism='DIGEST-MD5' />");
      stream_events_manager.addListener('end|challenge|' + NS_SASL, onChallengeReceived);
    } else {
      this.write("<auth xmlns='" + NS_SASL + "' mechanism='PLAIN'>"
		 + base64.encode('\x00' + conf.login + '\x00' + conf.password) + "</auth>");
    }
  }, this);
  var onChallengeReceived = recontext(function (element) {
    stream_events_manager.removeListener('end|challenge|' + NS_SASL, onChallengeReceived);
    md5dig.processing(element.nodeValue, {username: conf.login,
                                          realm: conf.domain,
					  'digest-uri': 'xmpp/' + conf.domain,
					  password: conf.password}, onResponseReady);
  }, this);
  var onResponseReady = recontext(function (response) {
    this.write("<response xmlns='" + NS_SASL + "'>" + response + "</response>");
    stream_events_manager.addListener('end|failure|' + NS_SASL, onChallengeFailed);
    stream_events_manager.addListener('end|challenge|' + NS_SASL, onChallengeSuccess);
  }, this);
  var onChallengeFailed = recontext(function () {
    throw new Error('md5-digest challenge failed (bad login/password ?)');
  }, this);
  var onChallengeSuccess = recontext(function () {
    this.write("<response xmlns='" + NS_SASL + "'/>");
  }, this);

  var mechanisms = [];
  var setMechanism = recontext(function (element) {
    mechanisms.push(element.nodeValue);
  }, this);
  var initiateSession = recontext(function () {
    this.write('<stream:stream to="' + conf.host + '" '
	       + 'xmlns="' + NS_CLIENT + '" '
	       + 'xmlns:stream="' + NS_STREAMS + '" '
	       + 'version="1.0" >');
  }, this);
  var resourceBindings = recontext(function () {
    sendIq({type: 'set'}, '<bind xmlns="' + NS_BIND + '"><resource>' + conf.resource + "</resource></bind>");
    stream_events_manager.removeListener('start|bind|' + NS_BIND, resourceBindings);
    var sessionBindings = recontext(function () {
      sendIq({type: 'set'}, '<session xmlns="' + NS_SESSION + '"></session>');
      stream_events_manager.removeListener('start|bind|' + NS_BIND, sessionBindings);
      var sendPresenceInformation = recontext(function () {
	stream_events_manager.removeListener('start|session|' + NS_SESSION, sendPresenceInformation);
	this.write('<presence><show>available</show><status>' + conf.status + '</status></presence>');
      }, this);
      stream_events_manager.addListener('start|session|' + NS_SESSION, sendPresenceInformation);
    }, this);
    stream_events_manager.addListener('start|bind|' + NS_BIND, sessionBindings);
    this.emit('resources.binded');
  }, this);
  var onMessageReceive =  recontext(function (attrs) {
    var onBodyReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|body|' + NS_CLIENT, onBodyReceived);
      this.emit('message.receive', attrs.from, element.nodeValue, attrs.to, attrs.type, attrs.id);
    }, this);
    var onHtmlBodyReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|body|' + NS_XHTML, onHtmlBodyReceived);
      this.emit('html.message.receive', attrs.from, element.nodeValue, attrs.to, attrs.type, attrs.id);
    }, this);
    var onMessageReceived =  recontext(function (buffer) {
      stream_events_manager.removeListener('end|body|' + NS_XHTML, onHtmlBodyReceived);
      stream_events_manager.removeListener('end|body|' + NS_CLIENT, onBodyReceived);
    }, this);
    stream_events_manager.addListener('end|body|' + NS_XHTML, onHtmlBodyReceived);
    stream_events_manager.addListener('end|body|' + NS_CLIENT, onBodyReceived);
    stream_events_manager.addListener('end|message|' + NS_CLIENT, onMessageReceived);
  }, this),
  onPresenceReceive = recontext(function (attrs) {
    var status, priority = "";
    if ('type' in attrs && attrs.type == 'unavailable') {
      return;
    }
    var statusReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|status|' + NS_CLIENT, statusReceived);
      status = element.nodeValue;
    }, this),
    priorityReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|priority|' + NS_CLIENT, priorityReceived);
      priority = element.nodeValue;
    }, this),
    presenceReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|presence|' + NS_CLIENT, presenceReceived);
      this.emit('presence.receive', attrs.from, attrs.to, status, priority, attrs.type);
    }, this);
    stream_events_manager.addListener('end|presence|' + NS_CLIENT, presenceReceived);
    stream_events_manager.addListener('end|priority|' + NS_CLIENT, priorityReceived);
    stream_events_manager.addListener('end|status|' + NS_CLIENT, statusReceived);
  }, this);
  var starttls = recontext(function () {
    this.write('<starttls xmlns="' + NS_TLS + '" />');
    stream_events_manager.removeListener('start|mechanisms|' + NS_SASL, sasl);
    stream_events_manager.addListener('start|proceed|' + NS_TLS, proceedTls);
  }, this);
  var proceedTls = recontext(function () {
     conn.setSecure();
//     sys.puts('setSecure');
     initiateSession();
  }, this);
  var sendIq = recontext(function (attrs, content, cb) {
    var id = 'req' + sendIq.nb_req++;
    attrs.id = id;
    var buffer = '<iq';
    for (var k in attrs) {
      buffer += ' ' + k + '="' + attrs[k] + '"';
    }
    this.write(buffer + '>' + content + '</iq>');
    if (typeof cb !== 'function') {
      return;
    }
    var onIqResponse = function (attrs) {
      stream_events_manager.removeListener('start|iq|' + NS_CLIENT, onIqResponse);
      if (attrs.id != id) {
	sys.puts('id !=');
	return;
      }
      stream_events_manager.addListener('end|iq|' + NS_CLIENT, onIqResponseEnding);
    };
    var onIqResponseEnding = function (element) {
      stream_events_manager.removeListener('end|iq|' + NS_CLIENT, onIqResponseEnding);
      cb(element);
    };
    stream_events_manager.addListener('start|iq|' + NS_CLIENT, onIqResponse);
  }, this);
  sendIq.nb_req = 0;
  var stream_events_manager = (new events.EventEmitter)
    .addListener('start|stream|' + NS_STREAMS, setID)
    .addListener('start|success|' + NS_SASL, initiateSession)
    .addListener('start|bind|' + NS_BIND, resourceBindings)
    .addListener('start|message|' + NS_CLIENT, onMessageReceive)
    .addListener('start|presence|' + NS_CLIENT, onPresenceReceive)
    .addListener('end|mechanism|' + NS_CLIENT, setMechanism)
    .addListener('end|mechanisms|' + NS_SASL, sasl);
  if (false && conf && 'tls' in conf && conf.tls) {
    stream_events_manager.addListener('start|starttls|' + BIND_TLS, starttls);
  }
  var Element = function (elem, parent, attrs, prefix, uri, namespaces) {
    this.name = elem;
    this.attributes = attrs || {};
    this.prefix = prefix || '';
    this.uri = uri || '';
    this.namespaces = namespaces || '';
    this.children = [];
    this.nodeValue = '';
    this.cdata = '';
    this.parent = parent;
    if (this.parent) {
      this.parent.children.push(this);
    }
  };
  var xml_parser = new libxml.SaxPushParser(function(cb) {
    var parent_node = new Element('root'),
    current_node = null, value = '', cdata = '';
    cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
      xml_parser.current_elem = elem;
      current_node = new Element(elem, parent_node, attrs, prefix, uri, namespaces);
      parent_node = current_node;
      if (stream_events_manager.listeners('start|' + elem+ '|' + uri).length > 0) {
	var params = {};
        for (var i = 0, l = attrs.length; i < l; ++i) {
	  params[attrs[i][0]] = attrs[i][3];
	}
	stream_events_manager.emit('start|' + elem+ '|' + uri, params);
      }
    });
    cb.onEndElementNS(function(elem, prefix, uri) {
      //sys.puts('end|' + elem+ '|' + uri);
      current_node.nodeValue = value.trim();
      value = '';
      current_node.cdata = cdata.trim();
      cdata = '';
      stream_events_manager.emit('end|' + elem+ '|' + uri, current_node);
      current_node = parent_node = current_node.parent;
    });
    cb.onCharacters(function (chars) {
      value += chars;
    });
    cb.onCdata(function (chars) {
      cdata += chars;
    });
  });
  var conn;
  var init = function () {
    //sys.puts(sys.inspect(conf));
    conn = tcp.createConnection(conf.port || 5222, conf.host)
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
      var l = "<?xml version='1.0'?>".length;
      if (data.substring(0, l) == "<?xml version='1.0'?>") {
	data = data.substring(l);
      }
      xml_parser.push(data);
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
  };

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
  //conf.port = conf.port || 5222;
  //conf.host = conf.host || conf.domain;
  conf.status = conf.status || 'ready';
  conf.resource = conf.resource || 'LePote';
  if ('host' in conf) {
    init();
  } else {
    dns.resolveSrv('_xmpp-client._tcp.' + conf.domain, function (err, domains) {
      if (err) {
        conf.host = conf.domain;
        init();
        return;
      }
      var max_prior = 0, res = {};
      domains.forEach(function (domain) {
        if (domain.priority + domain.priority * domain.weight >= max_prior) {
          max_prior = domain.priority + domain.priority * domain.weight;
          res = domain;
        }
      });
      conf.host = res.name;
      conf.port = conf.port || res.port;
      init();
    });
  }

  /* Public methods */

  this.id = 0;
  this.jid = conf.login + '@' + conf.domain + '/' + conf.resource;
  this.getVCard = function (to, cb) {
    var opts = {type: 'get'};
    if (to === null) {
      opts.from = jid;
    } else {
      opts.to = to;
    }
    sendIq(opts, '<vCard xmlns="' + NS_VCARD + '" />', function (element) {
      cb(element.children[0]);
    });
  };
  this.push = function (to, str) {
    var raw = '<message from="' + this.jid + '" '
              + 'to="' + to +'" type="chat"><body>' + str + '</body></message>';
    this.write(raw);
    this.emit('message.sent', to, str);
  };
  this.pushHtml = function (to, str) {
    var raw = '<message from="' + conf.login + '@' + conf.domain + '/' + conf.resource + '" '
      + 'to="' + to +'" type="chat"><body>' + str.replace(/(\<[^\>]+\>|\<\/[^\>]+\>|\<[^\>]+\/\>)/g, '') + '</body>'
	      + '<html xmlns="' + NS_XHTML_IM + '">'
	      + '<body xmlns="' + NS_XHTML + '">' + str + '</body></html></message>';
    this.write(raw);
    this.emit('html.message.sent', to, str);
  };
  this.subscribe = function (to, group, name) {
    group = group || 'Group';
    name = name || to;
    sendIq({type: 'set'}, '<query xmlns="' + NS_ROASTER + '">'
	   + '    <item'
           + '        jid="' + to + '"'
           + '        name="'+ name +'">'
           + '      <group>' + group + '</group>'
           + '    </item>'
           + '  </query>');
    this.write('<presence to="'+ to +'" type="subscribed" />');
  };
  this.write = function (data) {
    conn.write(data);
    //sys.puts('[ sent ] ' + data);
  };
};

for (var k in events.EventEmitter.prototype) {
  Client.prototype[k] = events.EventEmitter.prototype[k];
}

exports.Client = Client;
exports.NS_SASL = NS_SASL;
exports.NS_BIND = NS_BIND;
exports.NS_SESSION = NS_SESSION;
exports.NS_CLIENT = NS_CLIENT;
exports.NS_XHTML = NS_XHTML;
exports.NS_XHTML_IM = NS_XHTML_IM;
exports.NS_TLS = NS_TLS;
exports.NS_STREAMS = NS_STREAMS;
exports.NS_ROASTER = NS_ROASTER;
exports.NS_VCARD = NS_VCARD;