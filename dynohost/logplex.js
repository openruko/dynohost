var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var conf = require('./conf');

var LOGPLEX_HOSTNAME = conf.logplex.hostname;
var LOGPLEX_HOSTPORT = conf.logplex.port;

function LogPlexClient(token) {

  this.write = function(msg) {
    var ts = +(new Date());
    var buffer = new Buffer(ts.toString() + ' ' + token + ' ' + msg);
    client.send(buffer, 0, buffer.length, LOGPLEX_HOSTPORT, LOGPLEX_HOSTNAME);
  };
}

module.exports = LogPlexClient;
