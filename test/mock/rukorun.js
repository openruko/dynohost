var net = require('net');
var Path = require('path');
var async  = require('async');
var _ = require('underscore');
var conf = require('../../dynohost/conf');
var socketPath = conf.dynohost.socketPath;

var sockets = exports.sockets = {}

exports.connectToSockets = function(cb){
  sockets.io = net.createConnection(Path.join(socketPath, 'io.sock'));
  sockets.command = net.createConnection(Path.join(socketPath, 'command.sock'));

  _(sockets).forEach(function(socket){
    socket.on('error', function(err) {
      console.dir(err);
      throw err;
    });
  });

  async.parallel([
    function(cb){
      sockets.io.on('connect', cb);
    },
    function(cb){
      sockets.command.on('connect', cb);
    }
  ], cb);
};


exports.closeSockets = function(cb){
  sockets.io.destroy();
  sockets.command.destroy();
  cb();
};
