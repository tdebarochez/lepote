
lepote.on('message', function(from, content) {
  if (/^ping$/.exec(content)) {
    this.push(from, 'pong');
  }
});

lepote.on('presence', function(from, to, status, priority, type) {
  if (type == 'subscribe' && to != this.jid) {
    this.subscribe(from);
  }
  if (typeof this.admin_jid !== "undefined") {
    this.push(this.admin_jid, 'receive presence from : ' + from
                            + ' to : ' + to
                            + ' status : ' + status
                            + ' priority : ' + priority);
  }
});

lepote.on('message.sent', function(to, msg) {
  console.log('[ send ] ' + to + ': ' + msg);
});
