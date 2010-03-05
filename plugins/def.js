var sys = require('sys'),
    http = require("http");
this.listeners = [];
this.listeners.push({'event': 'message.receive',
		     'func' : function(from, content, to, type, id) {
		       var that = this;
		       var res = /^def\s(.+)$/.exec(content);
                       if (res !== null) {
			 var google = http.createClient(80, "www.google.com");
			 var request = google.request("GET", "/search?q=define:"+res[1], {"host": "www.google.com"});
			 request.addListener('response', function (response) {
			   response.setBodyEncoding("utf8");
			   var buffer = '';
			   response.addListener("data", function (chunk) {
			     buffer += chunk.replace("\r", "");
			   });
			   response.addListener("end", function () {
			     var definition = /\<p\>\<li\>([^\<]+)\<br\>\<a href="\/url\?q=(http:\/\/en.wikipedia.org\/wiki\/[^&]+)&/.exec(buffer);
			     if (definition !== null) {
			       that.push(from, definition[1]+' '+definition[2]);
			     } else {
			       that.push(from, res[1] + " definition not found");
			     }
			   });
			 });
			 request.close();
                       }
                     }});