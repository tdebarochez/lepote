
lepote.on('message', function(from, content, to, type) {
  if (from !== this.admin_jid) {
    return;
  }
  if (content.substr(0, 4) === 'help') {
    return this.push(from, 'join <chatroom> : ask to bot to join <chatroom> conference.');
  }
  var res = null;
  if (res = /^join\s+([^@]+@.+\..+)$/.exec(content)) {
    this.write('<presence from="' + this.jid + '" '
              +         ' to="' + res[1] + '/LePote">'
              +  ' <x xmlns="' + xmpp.NS_MUC + '" />'
              + '</presence>');
    var participants = [];
    function addParticipant (from, to, status, priority, type, element) {
      participants.push(from);
      status = element.getElementsByTagNameNS(xmpp.NS_MUC, 'status');
      if (status.length > 0 && status[0].getAttribute('code') == 110) {
        this.removeListener('presence.receive', addParticipant);
        console.log(participants);
      }
    }
    this.on('presence', addParticipant);
    return;
  }
  if (res = /^Hi LePote !$/.exec(content)) {
    return this.push(from, 'hello, ' + from.replace(/^([^\/]+\/)/, ''), type);
  }
});
