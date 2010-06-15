/*
 * TODO : tls
 */
var sys    = require('sys'),
    tcp    = require('net'),
    fs     = require('fs'),
    events = require('events'),
    dns    = require('dns'),
    libxml = require('libxmljs'),
    base64 = require('./base64'),
    md5dig = require('./md5-digest');

function recontext (func, that) {
  return function () {
    return func.apply(that, arguments);
  };
}

exports.Client = function (conf) {
  /* Private methods */

  var setID = recontext(function (attrs) {
    this.id = attrs.id;
  }, this);
  var sasl = recontext(function (attrs) {
    stream_events_manager.removeListener('end|mechanism|urn:ietf:params:xml:ns:xmpp-sasl', setMechanism);
    if (mechanisms.indexOf('DIGEST-MD5')) {
      this.write("<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='DIGEST-MD5' />");
      stream_events_manager.addListener('end|challenge|urn:ietf:params:xml:ns:xmpp-sasl', onChallengeReceived);
    } else {
      this.write("<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>"
		 + base64.encode('\x00' + conf.login + '\x00' + conf.password) + "</auth>");
    }
  }, this);
  var onChallengeReceived = recontext(function (element) {
    stream_events_manager.removeListener('end|challenge|urn:ietf:params:xml:ns:xmpp-sasl', onChallengeReceived);
    md5dig.processing(element.nodeValue, {username: conf.login,
                                          realm: conf.domain,
					  'digest-uri': 'xmpp/' + conf.domain,
					  password: conf.password}, onResponseReady);
  }, this);
  var onResponseReady = recontext(function (response) {
    this.write("<response xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>" + response + "</response>");
    stream_events_manager.addListener('end|failure|urn:ietf:params:xml:ns:xmpp-sasl', onChallengeFailed);
    stream_events_manager.addListener('end|challenge|urn:ietf:params:xml:ns:xmpp-sasl', onChallengeSuccess);
  }, this);
  var onChallengeFailed = recontext(function () {
    throw new Error('md5-digest challenge failed (bad login/password ?)');
  }, this);
  var onChallengeSuccess = recontext(function () {
    this.write("<response xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>");
  }, this);

  var mechanisms = [];
  var setMechanism = recontext(function (element) {
    mechanisms.push(element.nodeValue);
  }, this);
  var initiateSession = recontext(function () {
    this.write('<stream:stream to="' + conf.host + '" '
	       + 'xmlns="jabber:client" '
	       + 'xmlns:stream="http://etherx.jabber.org/streams" '
	       + 'version="1.0" >');
  }, this);
  var resourceBindings = recontext(function () {
    sendIq({type: 'set'}, '<bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>' + conf.resource + "</resource></bind>");
    stream_events_manager.removeListener('start|bind|urn:ietf:params:xml:ns:xmpp-bind', resourceBindings);
    var sessionBindings = recontext(function () {
      sendIq({type: 'set'}, '<session xmlns="urn:ietf:params:xml:ns:xmpp-session"></session>');
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
    var onBodyReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|body|jabber:client', onBodyReceived);
      this.emit('message.receive', attrs.from, element.nodeValue, attrs.to, attrs.type, attrs.id);
    }, this);
    var onHtmlBodyReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|body|http://www.w3.org/1999/xhtml', onHtmlBodyReceived);
      this.emit('html.message.receive', attrs.from, element.nodeValue, attrs.to, attrs.type, attrs.id);
    }, this);
    var onMessageReceived =  recontext(function (buffer) {
      stream_events_manager.removeListener('end|body|http://www.w3.org/1999/xhtml', onHtmlBodyReceived);
      stream_events_manager.removeListener('end|body|jabber:client', onBodyReceived);
    }, this);
    stream_events_manager.addListener('end|body|http://www.w3.org/1999/xhtml', onHtmlBodyReceived);
    stream_events_manager.addListener('end|body|jabber:client', onBodyReceived);
    stream_events_manager.addListener('end|message|jabber:client', onMessageReceived);
  }, this),
  onPresenceReceive = recontext(function (attrs) {
    var status, priority = "";
    if ('type' in attrs && attrs.type == 'unavailable') {
      return;
    }
    var statusReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|status|jabber:client', statusReceived);
      status = element.nodeValue;
    }, this),
    priorityReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|priority|jabber:client', priorityReceived);
      priority = element.nodeValue;
    }, this),
    presenceReceived = recontext(function (element) {
      stream_events_manager.removeListener('end|presence|jabber:client', presenceReceived);
      this.emit('presence.receive', attrs.from, attrs.to, status, priority, attrs.type);
    }, this);
    stream_events_manager.addListener('end|presence|jabber:client', presenceReceived);
    stream_events_manager.addListener('end|priority|jabber:client', priorityReceived);
    stream_events_manager.addListener('end|status|jabber:client', statusReceived);
  }, this);
  var starttls = recontext(function () {
    this.write('<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls" />');
    stream_events_manager.removeListener('start|mechanisms|urn:ietf:params:xml:ns:xmpp-sasl', sasl);
    stream_events_manager.addListener('start|proceed|urn:ietf:params:xml:ns:xmpp-tls', proceedTls);
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
      stream_events_manager.removeListener('start|iq|jabber:client', onIqResponse);
      if (attrs.id != id) {
	sys.puts('id !=');
	return;
      }
      stream_events_manager.addListener('end|iq|jabber:client', onIqResponseEnding);
    };
    var onIqResponseEnding = function (element) {
      stream_events_manager.removeListener('end|iq|jabber:client', onIqResponseEnding);
      cb(element);
    };
    stream_events_manager.addListener('start|iq|jabber:client', onIqResponse);
  }, this);
  sendIq.nb_req = 0;
  var stream_events_manager = (new events.EventEmitter)
    .addListener('start|stream|http://etherx.jabber.org/streams', setID)
    .addListener('start|success|urn:ietf:params:xml:ns:xmpp-sasl', initiateSession)
    .addListener('start|bind|urn:ietf:params:xml:ns:xmpp-bind', resourceBindings)
    .addListener('start|message|jabber:client', onMessageReceive)
    .addListener('start|presence|jabber:client', onPresenceReceive)
    .addListener('end|mechanism|jabber:client', setMechanism)
    .addListener('end|mechanisms|urn:ietf:params:xml:ns:xmpp-sasl', sasl);
  if (false && conf && 'tls' in conf && conf.tls) {
    stream_events_manager.addListener('start|starttls|urn:ietf:params:xml:ns:xmpp-tls', starttls);
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
    sendIq(opts, '<vCard xmlns="vcard-temp" />', function (element) {
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
	      + '<html xmlns="http://jabber.org/protocol/xhtml-im">'
	      + '<body xmlns="http://www.w3.org/1999/xhtml">' + str + '</body></html></message>';
    this.write(raw);
    this.emit('html.message.sent', to, str);
  };
  this.subscribe = function (to, group, name) {
    group = group || 'Group';
    name = name || to;
    sendIq({type: 'set'}, '<query xmlns="jabber:iq:roster">'
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
  exports.Client.prototype[k] = events.EventEmitter.prototype[k];
}
