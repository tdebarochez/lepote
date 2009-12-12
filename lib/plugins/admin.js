this.listeners = [];
this.listeners.push({'event': 'message.receive',
		     'func' : function(from, content, to, type, id) {
                       if (/^ping$/.exec(content)) {
			 this.push(from, 'pong');
                       } else {
                         this.push(from, 'command unknow : ' + content);
                       }
                     }});
