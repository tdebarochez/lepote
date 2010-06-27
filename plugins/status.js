exports.events = [function() {
  this.addListener('message.receive', function(from, content, to, type, id) {
    var res;
    if ((res = /^status\s+(.*)$/.exec(content))) {
      this.setStatus(res[1]);
    }
  });
}];