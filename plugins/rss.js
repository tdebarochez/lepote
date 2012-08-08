var FeedListener = require('../lib/feedlistener')
  , listener = new FeedListener({'interval': 3600000,
                                 "skip_first": true})
  , fs = require('fs')
  , cache_file = './rss_cache.json'
  , cache = fs.existsSync(cache_file) ? require('.' + cache_file) : {};

var push = function(item, from, url) {
  if (cache[from][url] < +item.pubDate) {
    cache[from][url] = +item.pubDate;
  }
  lepote.pushHtml(from, '<a href="' + item.link.replace(/&amp;/g, '&').replace(/&/g, '&amp;') + '">'
                      + '<strong>' + item.title + '</strong></a> <em>' + item.pubDate + '</em><br />'
                      + item.description);
};

for (var jid in cache) {
  if (!cache.hasOwnProperty(jid)) {
    continue;
  }
  for (var url in cache[jid]) {
    if (!cache[jid].hasOwnProperty(url)) {
      continue;
    }
    listener.add(url, cache[jid][url], function (item) {
      push(item, jid, url);
    });
  }
}

lepote.on('message', function(from, content) {
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'rss add <stream_url> : send message when a new article appears on RSS stream.' + "\n"
                         + 'rss rm <stream_url> : un-subscribe to a stream' + "\n"
                         + 'rss list : show every subscribed stream');
  }
  var res = /^rss\s+add\s+(.+)$/.exec(content);
  if (res === null) {
    return;
  }
  from = this.getBareJid(from);
  if (!(from in cache)) {
    cache[from] = {};
  }
  if (!(res[1] in cache[from])) {
    cache[from][res[1]] = 0;
  }
  listener.add(res[1], function (item) {
    push(item, from, res[1]);
  });
  console.log('listen : ' + res[1]);
});

lepote.on('message', function(from, content) {
  var res = /^rss\s+list$/.exec(content);
  if (res === null) {
    return;
  }
  var bare_jid = this.getBareJid(from);
  if (!(bare_jid in cache)) {
    return this.push(bare_jid, 'none');
  }
  var urls = [];
  for (var url in cache[bare_jid]) {
    if (!cache[bare_jid].hasOwnProperty(url)) {
      continue;
    }
    urls.push(url);
  }
  return this.push(from, urls.join('\n'));
});

setInterval(function () {
  fs.writeFileSync(cache_file, JSON.stringify(cache));
}, 60000);
