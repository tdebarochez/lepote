var sax = require('sax')
  , fs = require('fs')
  , http = require('http')
  , events = require('events')
  , Element = require('./utils').Element;

function FeedListener(opts) {
  var self = this
    , opts = opts || {};
  this.skip_first = !!opts.skip_first;
  function parse () {
    for (var k in self.cache) {
      var url = self.cache[k];
      http.get(url.address, function (res) {
        if (Math.round(res.statusCode / 100) !== 2) {
          return console.error('status code %d', res.statusCode);
        }
        console.log(url.address + ' status : ' + res.statusCode);
        var parser = self.getParser(function (root_node) {
          var channel = root_node.children[0].children[0];
          var items = []
            , max_date = null;
          channel.children.forEach(function (node) {
            if (node.name === 'item') {
              var item = {};
              node.children.forEach(function (item_attrs) {
                if (item_attrs.name === 'pubDate') {
                  item.pubDate = new Date(item_attrs.nodeValue);
                  if (max_date === null || +item.pubDate > +max_date) {
                    max_date = item.pubDate;
                  }
                }
                else {
                  item[item_attrs.name] = item_attrs.nodeValue.trim().length
                                        ? item_attrs.nodeValue : item_attrs.cdata;
                }
              });
              items.push(item);
            }
          });
          items.forEach(function (item) {
            if (+url.last_pub_date < +item.pubDate) {
              url.listener.emit('item', item);
            }
          });
          url.last_pub_date = max_date;
        });
        res.on('data', function (data) {
          parser.push(data.toString('utf8'));
        });
      }).on('error', function(e) {
        console.log("Got error: " + e.message);
      });
    }
    setTimeout(parse, opts.interval || 1800);
  }
  parse();
}

FeedListener.prototype.add = function (url, last_pub_date, cb) {
  if (typeof last_pub_date === "function") {
    cb = last_pub_date;
    last_pub_date = this.skip_first ? new Date : 0;
  }
  if (!(url in this.cache)) {
    this.cache[url] = {
      "address": url,
      "last_pub_date": last_pub_date,
      "listener": new events.EventEmitter
    }
  }
  this.cache[url].listener.on('item', cb);
};

FeedListener.prototype.getParser = function (cb) {
  var parent_node = new Element('root'),
  current_node = null, value = '', cdata = '';
  var parser = sax.parser(true, {xmlns: true, trim: true});
  parser.onopentag = function (elt) {
    var name = '';
    if (elt.name.substr(0, elt.prefix.length) === elt.prefix
        && '' !== elt.prefix) {
      name = elt.name.substr(elt.prefix.length + 1);
    }
    else {
      name = elt.name;
    }
    parser.current_elem = elt;
    current_node = new Element(name, parent_node, elt.attributes, elt.prefix, elt.uri);
    parent_node = current_node;
    var params = {};
    for (var key in elt.attributes) {
      params[elt.attributes[key].name] = elt.attributes[key].value;
    }
    stream_events_manager.emit('start|' + name + '|' + elt.uri, params);
  };
  parser.onclosetag = function (tag_name) {
    current_node.nodeValue = value;
    value = '';
    current_node.cdata = cdata;
    cdata = '';
    stream_events_manager.emit('end|' + current_node.name + '|' + current_node.uri, current_node);
    current_node = parent_node = current_node.parent;
    if (current_node.name === 'root' && current_node.parent === undefined) {
      cb(current_node);
    }
  };
  parser.ontext = function (str) {
    value += str;
  };
  parser.oncdata = function (str) {
    cdata += str;
  };
  return parser;
};

FeedListener.prototype.cache = {};

module.exports = FeedListener;