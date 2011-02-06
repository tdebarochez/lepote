var sys = require('sys'),
    fs  = require('fs');
exports.events = [function() {
  var jid = this.jid;
  this.addListener('message.receive', function(from, content, to, type, id) {
    if (/^vcard$/.test(content)) {
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
}];