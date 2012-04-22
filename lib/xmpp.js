var sys    = require('util'),
    tcp    = require('net'),
    fs     = require('fs'),
    events = require('events'),
    dns    = require('dns'),
    libxml = require('libxmljs'),
    md5dig = require('./md5-digest');

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

conn,
xml_parser,
stream_events_manager,


/**
 * == XMPP ==
 * XMPP library
 *
 **/

/** section: XMPP
 * class Client
 *
 * Here is the XMPP client class. Each instances inherits EventEmiter methods. Events are :
 * - `message.receive`, parameters are : `from`, `message`, `receiver`, `message_type`, `message_id`
 * - `message.sent`, parameters are : `to`, `message`
 * - `presence.receive`, parameters are : `from`, `to`, `status`, `priority`, `type`
 * - `resources.binded`, no parameters : called when session start.
 **/

/**
 * new Client([conf])
 * - conf (Object): hash with following keys : `login`, `password`, `domain`, `host`, `port`, `resource`, `status`
 *
 * Example of usage :
 *
 *     var xmpp = require('xmpp');
 *     var conf = {login: 'user',
 *                 password: 'pass',
 *                 domain: 'server.com'};
 *     var client = new xmpp.Client(conf);
 *     client.addListener('message.receive', doSomeStuff);
 *
 * If conf is omitted, it will try to load parameters from this following file `~/.sendxmpprc`. Example of content :
 *
 *     test@localhost:5222 password
 *
 **/
Client = function (conf) {

  var self = this, mechanisms = [];

  function setID (attrs) {
    self.id = attrs.id;
  }

  function sasl () {
    stream_events_manager.removeListener('end|mechanism|' + NS_SASL, setMechanism);
    if (mechanisms.indexOf('DIGEST-MD5')) {
      self.write("<auth xmlns='" + NS_SASL + "' mechanism='DIGEST-MD5' />");
      stream_events_manager.addListener('end|challenge|' + NS_SASL, onChallengeReceived);
    }
    else {
      self.write("<auth xmlns='" + NS_SASL + "' mechanism='PLAIN'>"
                 + (new Buffer('\x00' + conf.login + '\x00' + conf.password)).toString('base64') + "</auth>");
    }
  }

  function onChallengeReceived (element) {
    stream_events_manager.removeListener('end|challenge|' + NS_SASL, onChallengeReceived);
    md5dig.processing(element.nodeValue, {username: conf.login,
                                          realm: conf.domain,
                                          'digest-uri': 'xmpp/' + conf.domain,
                                          password: conf.password}, onResponseReady);
  }

  function onResponseReady (response) {
    self.write("<response xmlns='" + NS_SASL + "'>" + response + "</response>");
    stream_events_manager.addListener('end|failure|' + NS_SASL, onChallengeFailed);
    stream_events_manager.addListener('end|challenge|' + NS_SASL, onChallengeSuccess);
  }

  function onChallengeFailed () {
    throw new Error('md5-digest challenge failed (bad login/password ?)');
  }

  function onChallengeSuccess () {
    self.write("<response xmlns='" + NS_SASL + "'/>");
  }

  function setMechanism (element) {
    mechanisms.push(element.nodeValue);
  }

  function initiateSession () {
    self.write('<stream:stream to="' + conf.host + '" '
               + 'xmlns="' + NS_CLIENT + '" '
               + 'xmlns:stream="' + NS_STREAMS + '" '
               + 'version="1.0" >');
  }

  function resourceBindings () {
    self.sendIq({type: 'set'}, '<bind xmlns="' + NS_BIND + '"><resource>' + conf.resource + "</resource></bind>");
    stream_events_manager.removeListener('start|bind|' + NS_BIND, resourceBindings);
    function sessionBindings () {
      self.sendIq({type: 'set'}, '<session xmlns="' + NS_SESSION + '"></session>');
      stream_events_manager.removeListener('start|bind|' + NS_BIND, sessionBindings);
      function sendPresenceInformation () {
        stream_events_manager.removeListener('start|session|' + NS_SESSION, sendPresenceInformation);
        self.setStatus('ready', conf.status);
      }
      stream_events_manager.addListener('start|session|' + NS_SESSION, sendPresenceInformation);
    }
    stream_events_manager.addListener('start|bind|' + NS_BIND, sessionBindings);
    self.emit('resources.binded');
  }

  function onMessageReceive (attrs) {

    function onBodyReceived (element) {
      stream_events_manager.removeListener('end|body|' + NS_CLIENT, onBodyReceived);
      self.emit('message.receive', attrs.from, element.nodeValue, attrs.to, attrs.type, attrs.id);
    }

    function onHtmlBodyReceived (element) {
      stream_events_manager.removeListener('end|body|' + NS_XHTML, onHtmlBodyReceived);
      self.emit('html.message.receive', attrs.from, element.nodeValue, attrs.to, attrs.type, attrs.id);
    }

    function onMessageReceived () {
      stream_events_manager.removeListener('end|body|' + NS_XHTML, onHtmlBodyReceived);
      stream_events_manager.removeListener('end|body|' + NS_CLIENT, onBodyReceived);
    }

    stream_events_manager.addListener('end|body|' + NS_XHTML, onHtmlBodyReceived);
    stream_events_manager.addListener('end|body|' + NS_CLIENT, onBodyReceived);
    stream_events_manager.addListener('end|message|' + NS_CLIENT, onMessageReceived);
  }

  function onPresenceReceive (attrs) {
    var status, priority = "";
    if ('type' in attrs && attrs.type == 'unavailable') {
      return;
    }

    function statusReceived (element) {
      stream_events_manager.removeListener('end|status|' + NS_CLIENT, statusReceived);
      status = element.nodeValue;
    }

    function priorityReceived (element) {
      stream_events_manager.removeListener('end|priority|' + NS_CLIENT, priorityReceived);
      priority = element.nodeValue;
    }

    function presenceReceived () {
      stream_events_manager.removeListener('end|presence|' + NS_CLIENT, presenceReceived);
      self.emit('presence.receive', attrs.from, attrs.to, status, priority, attrs.type);
    }

    stream_events_manager.addListener('end|presence|' + NS_CLIENT, presenceReceived);
    stream_events_manager.addListener('end|priority|' + NS_CLIENT, priorityReceived);
    stream_events_manager.addListener('end|status|' + NS_CLIENT, statusReceived);
  }

  function starttls () {
    self.write('<starttls xmlns="' + NS_TLS + '" />');
    stream_events_manager.removeListener('start|mechanisms|' + NS_SASL, sasl);
    stream_events_manager.addListener('start|proceed|' + NS_TLS, proceedTls);
  }

  function proceedTls () {
     conn.setSecure();
//     sys.puts('setSecure');
     initiateSession();
  }

  function init () {
    //sys.puts(sys.inspect(conf));
    self.jid = conf.login + '@' + conf.domain + '/' + conf.resource;
    conn = tcp.createConnection(conf.port || 5222, conf.host);

    conn.addListener("disconnect", function (error) {
      if (eError) {
        throw "disconnected server in error";
      }
    });

    conn.addListener("connect", function () {
      this.setTimeout(0);
      this.setEncoding("utf8");
      initiateSession();
    });

    conn.addListener("data", function (data) {
      //sys.puts('[ rcv ] ' + data);
      var l = "<?xml version='1.0'?>".length;
      if (data.substring(0, l) == "<?xml version='1.0'?>") {
        data = data.substring(l);
      }
      xml_parser.push(data);
    });

    conn.addListener("close", function (error) {
      if (error) {
        throw 'connection close with error';
      }
    });

    conn.addListener("end", function () {
      this.write('</stream:stream>');
      sys.puts('[ eof ] ');
    });
  }

  stream_events_manager = (new events.EventEmitter)
    .addListener('start|stream|' + NS_STREAMS, setID)
    .addListener('start|success|' + NS_SASL, initiateSession)
    .addListener('start|bind|' + NS_BIND, resourceBindings)
    .addListener('start|message|' + NS_CLIENT, onMessageReceive)
    .addListener('start|presence|' + NS_CLIENT, onPresenceReceive)
    .addListener('end|mechanism|' + NS_CLIENT, setMechanism)
    .addListener('end|mechanisms|' + NS_SASL, sasl);

  if (false && conf && 'tls' in conf && conf.tls) {
    stream_events_manager.addListener('start|starttls|' + NS_TLS, starttls);
  }


  function Element (elem, parent, attrs, prefix, uri, namespaces) {
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
  }

  var parent_node = new Element('root'),
  current_node = null, value = '', cdata = '';
  xml_parser = new libxml.SaxPushParser({
    "startElementNS": function(elem, attrs, prefix, uri, namespaces) {
      //sys.puts('start|' + elem+ '|' + uri);
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
    },
    "endElementNS": function(elem, prefix, uri) {
      //sys.puts('end|' + elem+ '|' + uri);
      current_node.nodeValue = value.trim();
      value = '';
      current_node.cdata = cdata.trim();
      cdata = '';
      stream_events_manager.emit('end|' + elem+ '|' + uri, current_node);
      current_node = parent_node = current_node.parent;
    },
    "characters": function (chars) {
      value += chars;
    },
    "cdata": function (chars) {
      cdata += chars;
    }
  });

  if (!conf) {
    try {
      var content = fs.readFileSync(process.env.HOME + "/.sendxmpprc");
      var match = /^([^@]+)@([^:]+):([^ ]+) (\w+)/gi.exec(content);
      conf = {login: match[1],
              domain: match[2],
              port: match[3],
              password: match[4]};
    } catch (e) { console.log(e); }
  }
  if (!conf || !("login" in conf) || !conf.login || conf.login.length < 1) {
    throw "[ error ] login missing";
  }

  conf.status = conf.status || 'ready';
  conf.resource = conf.resource || 'LePote';

  if ('host' in conf) {
    init();
  }
  else {
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
};


sys.inherits(Client, events.EventEmitter);

/**
 * Client#id -> Number
 *
 * Session id send by server
 **/
Client.prototype.id = 0;

/**
 * Client#jid -> String
 *
 * Client jid : `user@domain/resource` define by configuration in constructor
 **/
Client.prototype.jid = '';

/**
 * Client#getVCard([to[, callback]]) -> Client
 * - to (String): a jid whose get vCard, if ommitted Client.jid is used
 * - callback (Function): a function called with xml element in parameter
 *
 * Call `callback` function with vCard's `to` as parameter.
 **/
Client.prototype.getVCard = function (to, cb) {
  var opts = {type: 'get'};
  if (to === null) {
    opts.from = jid;
  }
  else {
    opts.to = to;
  }
  this.sendIq(opts, '<vCard xmlns="' + NS_VCARD + '" />', function (element) {
    if (typeof cb == 'function') {
      cb(element.children[0]);
    }
  });
  return this;
};

/**
 * Client#push(to, str) -> Client
 * - to (String): receiver jid (ex: "john.doe@domain.com") to send message
 * - str (String): the message
 *
 * Send instant message.
 **/
Client.prototype.push = function (to, str) {
  var raw = '<message from="' + this.jid + '" '
          + 'to="' + to +'" type="chat"><body>' + str + '</body></message>';
  this.write(raw);
  this.emit('message.sent', to, str);
  return this;
};

/**
 * Client#pushHtml(to, str) -> Client
 * - to (String): a jid to send message
 * - str (String): the html message
 *
 * Send HTML instant message.
 **/
Client.prototype.pushHtml = function (to, str) {
  var raw = '<message from="' + this.jid + '" '
          + 'to="' + to +'" type="chat"><body>' + str.replace(/(\<[^\>]+\>|\<\/[^\>]+\>|\<[^\>]+\/\>)/g, '') + '</body>'
          + '<html xmlns="' + NS_XHTML_IM + '">'
          + '<body xmlns="' + NS_XHTML + '">' + str + '</body></html></message>';
  this.write(raw);
  this.emit('html.message.sent', to, str);
  return this;
};

/**
 * Client#sendIq(attrs, content[, cb]) -> Client
 * - attrs (Object): request attributes
 * - content (String): content of request
 * - cb (Function): Callback function
 *
 **/
Client.prototype.sendIq = function (attrs, content, cb) {
  if (typeof this.sendIq.nb_req == 'undefined') {
    this.sendIq.nb_req = 0;
  }
  var id;
  id = 'req' + this.sendIq.nb_req++;
  attrs.id = id;
  var buffer = '<iq';
  for (var k in attrs) {
    buffer += ' ' + k + '="' + attrs[k] + '"';
  }
  this.write(buffer + '>' + content + '</iq>');
  if (typeof cb !== 'function') {
    return this;
  }

  function onIqResponse (attrs) {
    stream_events_manager.removeListener('start|iq|' + NS_CLIENT, onIqResponse);
    if (attrs.id != id) {
      sys.puts('id !=');
      return;
    }
    stream_events_manager.addListener('end|iq|' + NS_CLIENT, onIqResponseEnding);
  }

  function onIqResponseEnding (element) {
    stream_events_manager.removeListener('end|iq|' + NS_CLIENT, onIqResponseEnding);
    cb(element);
  }

  stream_events_manager.addListener('start|iq|' + NS_CLIENT, onIqResponse);
  return this;
};

/**
 * Client#setStatus([show[, status[, priority]]]) -> Client
 * - status (String): contains non-human-readable XML character data that specifies the particular availability status. Default : "ready".
 * - show (String): detailled description of an availability state. Default : "Available".
 * - priority (Number): specify the priority level of the resource.
 *
 * Set client status and priority.
 **/
Client.prototype.setStatus = function (show, status, priority) {
  var statuses = {away: "Temporarily away",
                  chat: "Interested in chatting",
                  dnd: "Do not disturb",
                  xa: "Extended away",
                  ready: "Available"};
  show = statuses[show] ? show : 'ready';
  status = status !== null ? status : statuses[show];
  priority = !isNaN(priority) ? priority : false;
  this.write('<presence>');
  this.write('<show>' + show + '</show>');
  if (status) {
    this.write('<status>' + status + '</status>');
  }
  if (priority) {
    this.write('<priority>' + priority + '</priority>');
  }
  this.write('</presence>');
};

/**
 * Client#subscribe(to[, group[, name]]) -> Client
 * - to (String): a jid to add to roadster
 * - group (String): the group, default "Group"
 * - name (String): Alias, default first argument
 *
 * Add somebody to your roaster
 **/
Client.prototype.subscribe = function (to, group, name) {
  group = group || 'Group';
  name = name || to;
  this.sendIq({type: 'set'}, '<query xmlns="' + NS_ROASTER + '">'
              + '    <item'
              + '        jid="' + to + '"'
              + '        name="'+ name +'">'
              + '      <group>' + group + '</group>'
              + '    </item>'
              + '  </query>');
  return this.write('<presence to="'+ to +'" type="subscribed" />');
};

/**
 * Client#write(data) -> Client
 * - data (String): raw data to send
 *
 * Write raw datas
 **/
Client.prototype.write = function (data) {
  conn.write(data);
  //sys.puts('[ sent ] ' + data);
  return this;
};

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
