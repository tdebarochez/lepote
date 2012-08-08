var xmpp = require('./lib/xmpp')
  , express = require('express')
  , app = express()
  , fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , bot = null;

try {

  app.configure('development', function(){
      app.use(express.static(__dirname + '/public'));
      app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  });

  app.configure('production', function(){
    var oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
    app.use(express.errorHandler());
  });

  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);

  global.app = app;
  var dir = 'webserver_plugins';
  fs.readdirSync(path.join(__dirname, dir)).forEach(function(file){
    if (/\.js$/.exec(file) === false) {
      return;
    }
    require('./' + path.join(dir, file));
    console.log('[ load ] ' + path.join(dir, file));
  });

  app.listen(process.env['app_port'] || 3000);

  console.log('server started in ' + app.get('env') + ' mode');

}
catch (e) {
  console.error(e);
}
