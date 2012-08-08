var secret_hash = Math.random().toString().substr(2, 10);
console.log('admin secret hash : ' + secret_hash);

lepote.on('message', function(from, content) {
  if (content.substr(0, 4) === 'help') {
    var help = ['admin <secret-hash> : become admin'];
    if (from == this.admin_jid) {
      help.push('admin roster : display bot\'s contact list');
    }
    return this.push(from, help.join("\n"));
  }
  var self = this, res = null;
  if (/^admin\s+roster$/.exec(content)) {
    if (from != this.admin_jid) {
      return this.push(from, 'you need to be admin');
    }
    var roster = [];
    this.getRoster(function (items) {
      items.forEach(function (item) {
        var groups = [];
        item.getElementsByTagNameNS(xmpp.NS_ROSTER, 'group').forEach(function (node) {
          groups.push(node.nodeValue);
        });
        if (groups.length > 0) {
          groups = ' [' + groups.join('|') + ']';
        }
        roster.push(item.getAttribute('name') + ' <' + item.getAttribute("jid") + '>' + groups + ' (' + item.getAttribute('subscription')+ ')');
      });
      self.push(from, roster.join("\n"));
    });
  }
  else if ((new RegExp('^admin\\s+' + secret_hash + '$', 'gi')).exec(content)) {
    this.admin_jid = from;
    return this.push(from, "I'm waiting for your orders, my Master.")
  }
  else if (res = /^admin\s+roster\s+add\s+([^\s]+)\s*([^\s]*)\s*([^\s]*)\s*$/.exec(content)) {
    if (from != this.admin_jid) {
      return this.push(from, 'you need to be admin');
    }
    this.subscribe(res[1], res[2], res[3], function (elt) {
      console.log(res[1] + ' added to roster')
    });
  }
  });
