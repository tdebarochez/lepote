var rss_observer = require('rssee')
  , sys = require('util');
exports.events = [function() {
  this.addListener('message.receive', function(from, content) {
    if (content.substr(0, 4) === 'help') {
      return this.push(from, 'rss <stream_url> : send message when a new article appears on RSS stream.');
    }
    var res = /^rss\s(.+)$/.exec(content);
    if (res === null) {
      return;
    }
    var rss = rss_observer.create({'interval': 1800,
                                   'ignore_first_run': true});
    var that = this;
    rss.on('article', function(a) {
      that.pushHtml(from, '<strong>' + a.title + '</strong><br />' + a.description + '<br /><a href="' + a.link + '">en savoir plus</a>');
    });
    console.log('listen : ' + res[1]);
    try {
      rss.start(res[1]);
    }
    catch (e) {
      this.push(from, 'invalid stream');
    }
  });
}];