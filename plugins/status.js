exports.events = [function() {
  this.addListener('message.receive', function(from, content) {
    if (content.substr(0, 4) === 'help') {
      return this.push(from, 'status [chat|ready|away|dnd|xa] : change the bot status.');
    }
    var res;
    if ((res = /^status\s+(.*)$/.exec(content))) {
      this.setStatus(res[1]);
    }
  });
}];