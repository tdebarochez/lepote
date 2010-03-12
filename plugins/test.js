var sys = require('sys');
exports.events = [function() {
  this.addListener('message.receive', function(from, content, to, type, id) {
    if (/^ping$/.exec(content)) {
      this.push(from, 'pong');
    } else {
       // this.push(from, 'command unknow : ' + content);
     }
  });
  this.addListener('presence.receive', function(from, to, status, priority) {
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