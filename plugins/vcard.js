
lepote.on('message', function(from, content) {
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'vcard <jid> : example of vCard usage, send you the name relays to <jid>.');
  }
  if (/^vcard/.test(content)) {
    var that = this, res = content.split(' '),
    jid = res.length > 1 ? res[1] : from;
    this.getVCard(jid, function (vcardNode) {
      vcardNode.children.forEach(function (node) {
        if (node.name == 'FN') {
          that.push(from, 'Name: ' + node.nodeValue);
        }
      });
    });
  }
});
