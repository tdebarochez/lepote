this.listeners = [];
this.listeners.push({'event': 'message.receive',
		     'func' : function(client, from, content, to, type, id) {
                       if (/^ping$/.exec(content)) {
                         client.push(from, 'pong');
                       } else {
                         client.push(from, 'command unknow : ' + content);
                       }
                     }});
