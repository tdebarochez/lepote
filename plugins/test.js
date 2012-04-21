var sys = require('util');
exports.events = [function() {
  var jid = this.jid;
  this.addListener('message.receive', function(from, content) {
    if (/^ping$/.exec(content)) {
      this.push(from, 'pong');
    }
    else {
       // this.push(from, 'command unknow : ' + content);
     }
  });
  this.addListener('presence.receive', function(from, to, status, priority, type) {
    if (type == 'subscribe' && to != jid) {
      this.subscribe(from);
    }
    return;
    this.push('admin@localhost', 'receive presence from : ' + from
                                 + ' to : ' + to
                                 + ' status : ' + status
                                 + ' priority : ' + priority);
  });
  this.addListener('message.sent', function(to, msg) {
    sys.puts('[ send ] ' + to + ': ' + msg);
  });
}];