var sys = require('sys'),
    fs  = require('fs'),
    base64 = require('../deps/node-base64.js/base64');
exports.events = [function() {
  var jid = this.jid;
  this.addListener('message.receive', function(from, content, to, type, id) {
    var res;
    if ((res = /^vcard\s+(.*)$/.exec(content))) {
      var that = this;
      this.getVCard(res[1], function (vcardNode) {
	vcardNode.children.forEach(function (node) {
	  if (node.name == 'FN') {
            that.push(from, 'Name: ' + node.nodeValue);
	  }
	});
      });
    }
  });
}];