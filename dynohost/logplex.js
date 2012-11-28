var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var conf = require('./conf');

function LogPlexClient(token) {

  this.write = function(msg) {
    var ts = +(new Date());
    var buffer = new Buffer(ts.toString() + ' ' + token + ' ' + msg);
    client.send(buffer, 0, buffer.length, conf.logplex.udpPort, conf.logplex.hostname);
  };
}

module.exports = LogPlexClient;
