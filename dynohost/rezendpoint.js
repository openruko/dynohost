var tls = require('tls');
var fs = require('fs');

module.exports = RezServer;

function RezServer(dynoFetcher, options) {

  var server;

  this.start = function(getDyno) {

    server = tls.createServer(options, function(s) {

      s.setNoDelay(); // needed?
      s.once('data', function(data) {
        var strData = data.toString();
        var dataParts = strData.toString().split('\n');
        var secret = dataParts[0];
        var dynoId = dataParts[1];
        var disconnected = false;

         // if(secret !== 'xyz') {
         //    s.write('Not authorized.');
         //    s.destroySoon();
         //    return;
         // }
        
        var dyno = getDyno(dynoId);
        if(!dyno) {
          s.write('Dyno does not exist.');
          s.destroySoon();
          return;
        }
        console.log(dynoId + ' - Rez client connected ');

        if(dyno.currentState == 'listening') { dyno.run(); }

        dyno.on('data', function(data) {
          if(disconnected || !s.writable) return;
          s.write(data);
        });

        s.on('data', function(data) {
          if(disconnected) return;
          dyno.ioSocket.write(data);
        });

        s.on('end', function() {
          console.log(dynoId + ' - Rez Socket disconnected');
          disconnected = true;
          // catch early termination - still listening or about too
          if(dyno.currentState == 'listening') {
            dyno.stop();
          } else {
            dyno.on('stateChanged', function(state) {
              if(dyno.currentState == 'listening') {
                dyno.stop();
              }
            });
          }
        });

        dyno.on('stateChanged', function(state) {
          if(state === 'errored') {
            s.write('E: \n ! Problem provisioning build server\n\n');
            s.destroySoon();
          }
          if(state === 'completed') {
            s.destroySoon();
          }
          if((!disconnected) && state === 'listening') {
            dyno.run();
            dyno.ioSocket.setNoDelay();
            dyno.commandSocket.setNoDelay();
          }
        });

        dyno.on('exited', function() {
          s.destroySoon();
        });

      });

    });
    server.listen(options.port);
  };

  this.stop = function() {
    server.close();
  };
}
