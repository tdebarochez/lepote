var sys = require('sys');
this.listeners = [];
this.listeners.push({'event': 'message.receive',
		     'func' : function(from, content, to, type, id) {
                       if (/^ping$/.exec(content)) {
			 this.push(from, 'pong');
                       } else {
                        // this.push(from, 'command unknow : ' + content);
                       }
                     }});
this.listeners.push({'event': 'presence.receive',
		     'func' : function(from, to, status, priority) {
		       this.push('admin@localhost',
				 'receive presence from : ' + from
			         + ' to : ' + to
				 + ' status : ' + status
				 + ' priority : ' + priority);
                     }});
this.listeners.push({'event': 'message.sent',
		     'func' : function(to, msg) {
		       sys.puts('[ send ] ' + to + ': ' + msg);
                     }});
