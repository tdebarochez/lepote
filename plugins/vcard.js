var sys = require('sys');
exports.events = [function() {
  var jid = this.jid;
  this.addListener('message.receive', function(from, content, to, type, id) {
    var res;
    if ((res = /^vcard\s+(.*)$/.exec(content))) {
      var that = this;
      this.getVCard(res[1], function (vcardNode) {
	vcardNode.children.forEach(function (node) {
	  if (node.name != 'FN') {
	    return;
	  }
	  that.push(from, 'Name: ' + node.nodeValue);
	});
      });
    }
  });
}];