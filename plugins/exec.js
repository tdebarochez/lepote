
var spawn = require('child_process').spawn;

lepote.on('message', function(from, content) {
  if (from !== this.admin_jid) {
    return;
  }
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'exec <program> [arguments] : execute following command line');
  }
  var res, self = this;
  if ((res = /^exec\s+([^\s]+)\s*(.*)$/.exec(content))) {
    args = res.length > 2 ? res[2].split(/\s+/) : [];
    var pgrm = spawn(res[1], args);
    pgrm.stdout.on('data', function (data) {
      self.push(from, data);
    });
    pgrm.stderr.on('data', function (data) {
      self.push(from, data);
    });
    pgrm.on('exit', function (code) {
      if (code > 0) {
        self.push(from, res[1] + ' exited with code ' + code);
      }
    });
  }
});
