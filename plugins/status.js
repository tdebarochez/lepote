lepote.on('message', function(from, content) {
  if (from !== this.admin_jid) {
    return;
  }
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'status [chat|away|dnd|xa] : change the bot status.');
  }
  var res;
  if ((res = /^status\s+(.*)$/.exec(content))) {
    this.setStatus(res[1]);
  }
});
