var dgram = require('dgram');
var client = dgram.createSocket('udp4');

var serverParts = process.env.LOGPLEX_SERVER.split(':');
var LOGPLEX_HOSTNAME = serverParts[0];
var LOGPLEX_HOSTPORT = +(serverParts[1]);

function LogPlexClient(token) {

  this.write = function(msg) {
    var ts = +(new Date());
    var buffer = new Buffer(ts.toString() + ' ' + token + ' ' + msg);
    client.send(buffer, 0, buffer.length, LOGPLEX_HOSTPORT, LOGPLEX_HOSTNAME);
  };
}

module.exports = LogPlexClient;
