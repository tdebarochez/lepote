exports.events = [function() {
  this.addListener('message.receive', function(from, content) {
    var res;
    if ((res = /^status\s+(.*)$/.exec(content))) {
      this.setStatus(res[1]);
    }
  });
}];