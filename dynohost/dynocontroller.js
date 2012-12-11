var async = require('async');
var spawn = require('child_process').spawn;
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var LogPlexClient = require('./logplex');
var request = require('request');
var path = require('path');
var conf = require('./conf')
var _ = require('underscore');

module.exports = DynoStateMachine;
DynoStateMachine.prototype = new EventEmitter();

function DynoStateMachine(options) { 

  var self = this;
  self.id = options.dyno_id;
  self.options = options;
  self.currentState = 'idle';
  self.afterStartTimeout = 2500;
  self.port = undefined;

  // stuff we can do to the dyno
  var actions = [
    { name: 'start', from: 'idle', to: 'starting' },
    { name: 'run', from: 'listening', to: 'running' },
    { name: 'stop',  to: 'completed' }
  ];

  // events caused by the dyno on the dark side
  var events = [
    { event: 'connected', from: 'starting', to: 'listening' },
    { event: 'exit', from: 'running', to: 'completed' },
    { event: 'error', to: 'errored' }
  ];

  var setState = function(state) {
    self.currentState = state;
    self.emit('stateChanging', state);
    console.log(self.id + ' - State changed to ' + state);
    self.emit('stateChanged', state);
  };


  if(!options.attached) {
    self.logplexClient=new LogPlexClient(self.options.logplex_id);

    self.on('stateChanged', function(state) {
      if(state === 'listening') {
        self.run();
      }
    });

    self.on('data', function(data) {
      self.logplexClient.write(data);
    });
  }

  self.on('stateChanged', function(state) {
    if(state === 'completed') {
      console.log(self.id + ' - Cleanup due to process exit');
      self.stop();
    }
  });

  actions.forEach(function(action) {
    self[action.name] = function(cb) {

      console.log(self.id + ' - Executing ' + action.name + ' (current state: ' + 
               self.currentState + ')');

      if(action.from && self.currentState !== action.from) {
        return cb && cb({ error: 'must be in state ' + action.from + 
                  ' when call ' + action.name});
      }

      self.fn[action.name](function(actionError) {
        if(actionError) {
          setState('errored');
          return cb && cb({ error: 'unable to transition', 
                    internalError: actionError });
        }
        var afterName = 'after' + action.name.substr(0,1).toUpperCase() + 
          action.name.substr(1);
        if(self[afterName]) {
          self[afterName]();  
        } 
        setState(action.to);
        return cb && cb();
      });
    };
  });

  self.fire = function(eventName) {
    console.log(self.id + ' - Event ' + eventName + ' fired');
    var relatedEvent =  events.filter(function(ev) {
      return ev.event === eventName;
    })[0];
    if(relatedEvent && relatedEvent.to) {
      setState(relatedEvent.to);
    }
  };

  self.commandServer = self.buildSocketServer(self.id,'command');
  self.ioServer = self.buildSocketServer(self.id,'io');

  self.commandServer.on('connection', handleConnection('commandSocket'));
  self.ioServer.on('connection', handleConnection('ioSocket'));

  var connCount = 0;
  function handleConnection(socketName) {
    return function(socket) {
      console.log(self.id + ' - Socket ' + socketName + ' connected');
      self[socketName] = socket;
      connCount++;
      if(connCount === 2) {
        self.fire('connected');

        self.ioSocket.on('data', function(data) {
          //console.log(self.id + ' - Received some data');
          self.emit('data', data);
        });
        self.commandSocket.on('data', function(json) {
          var msg = JSON.parse(json.toString());
          if(self.logplexClient) {
            self.logplexClient.write(msg.message);
          }

          if(msg.type === 'exit'){
            self.exitCode = msg.code;
            self.fire('exit');
          }
        });
      }
    };
  }

  self.fn = {}; 
  self.fn.start = function(cb) { 

    var provisionScript = 'dynohost/scripts/' + self.options.template + '-provision';

    fs.exists(provisionScript, function(exists) {

      if(!exists) {
        provisionScript = 'dynohost/scripts/provision';
      }

      console.log(self.id + ' - provisioning with ' + provisionScript);

      var buildArgs = { 
        command: '/bin/bash', 
        args: [provisionScript,
          options.dyno_id, 
          // TODO why twice the same path
          path.join(conf.dynohost.socketPath, self.id),
          path.join(conf.dynohost.socketPath, self.id)].concat(Object.keys(self.options.mounts).map(function(mKey) {
            return mKey + ':' + self.options.mounts[mKey];
          }))
      };

      self.syncExecute(buildArgs, function(err, result) {
        console.dir(err || result);
        if(err) return cb(err);
        cb();
      }, 30000);

    });

  };

  self.afterStart = function(){
    
    setTimeout(timeoutIfNotConnected, self.afterStartTimeout);
    
    function timeoutIfNotConnected() {
      if(self.ioSocket && self.commandSocket) return;
     
      self.ioServer.close();
      self.commandServer.close();
      var tailLogArgs = ({ command: '/usr/bin/tail', 
                          args: ['-n20','run_' + self.id + '.txt'] });
      self.syncExecute(tailLogArgs, function(tailError, tailResult) {
        var effectiveResult = tailError || tailResult;
        if(effectiveResult.output.indexOf('No cgroup mounted') !== -1) {
          console.error(self.id + ' - No cgroup mounted on host system.');
        } else {
          console.error(self.id + ' - timeout sockets not connected - ' + effectiveResult.output);
        }
        self.fire('error', {});
      });
    }
  };

  function getPort() {
    // allocate from block range
    // check not used from bad previous shutdown

    // temp: somethingg from 10000  - 20000;
    return Math.ceil(Math.random() * 10000) + 10000;
  }

  self.fn.run = function(cb) {

    var env  = _(options.env_vars).defaults({
      http_proxy: process.env.http_proxy,
      HTTP_PROXY: process.env.HTTP_PROXY,
      https_proxy: process.env.https_proxy,
      HTTPS_PROXY: process.env.HTTPS_PROXY,
      no_proxy: process.env.no_proxy,
      NO_PROXY: process.env.NO_PROXY,

      // For people behind a proxy, proxy should accept npm CA cert
      // https://github.com/isaacs/npm/issues/1977#issuecomment-3761590
      //
      // I hope not to do this for each buildpack
      npm_config_registry: 'http://registry.npmjs.org'
    });

    self.port = getPort();
    env.PORT = self.port.toString();

    var command = {
      type: 'do',
      attached: options.attached,
      pty: options.pty,
      command: options.command,
      args: options.command_args || [],
      env_vars: env
    };

    console.log(self.id + ' - Dispatch command: ' + command.command + ' ' + command.args.join(' '));
    self.commandSocket.write(JSON.stringify(command) + '\n');
    cb();
  };

  self.fn.stop = function() {

    if(self.isStopping) return;

    self.isStopping = true;
    if(self.commandSocket) {
      self.commandSocket.write(JSON.stringify({ type: 'stop' }) + '\n');
    }

    // Max Timeout is 10s, after wihich SIGKILL is sent to every processes
    setTimeout(function() {
    
      if(self.commandSocket) self.commandSocket.destroy();
      if(self.ioSocket) self.ioSocket.destroy();

      console.log(self.id + ' - Cleaning up dyno');
      var cleanUpInstructions = {
        command: '/bin/bash',
        args: ['scripts/cleanup', self.id]
      };
      self.syncExecute(cleanUpInstructions, function() {
        console.log(self.id + ' - Cleaned up');
        self.status = 'completed';
        self.exitCode = 1;
        self.emit('exited');
      });

    },11000);
  };

}


DynoStateMachine.prototype.buildSocketServer = function(dyno_id, prefix) {
  var socketDir=path.join(conf.dynohost.socketPath, dyno_id);
  var socketPath=path.join(socketDir,prefix + '.sock');
  if(!fs.existsSync(socketDir)) {
    fs.mkdirSync(socketDir);
  }
  var server = net.createServer();
  server.listen(socketPath);
  return server;
};

DynoStateMachine.prototype.syncExecute = function (instructions, cb, timeout) {

  var stdout = '';
  var stderr = '';
  var combined = '';

  var inst = spawn(instructions.command, instructions.args, {
    cwd: path.join(__dirname, '..'),
    env: process.env
  });


  inst.stdout.setEncoding('utf8');
  inst.stdout.on('data', function(data) {
    stdout +=  data;
    combined +=  data;
  });

  inst.stderr.setEncoding('utf8');
  inst.stderr.on('data', function(data) {
    stderr += data;
    combined += data;
  });
  var completed = false;
  var timeoutId;

  if(typeof timeout !== undefined) {

    timeoutId = setTimeout(function() {
      if(!completed) {
        inst.kill('SIGKILL');
        inst.stdin.destroy();
        inst.stdout.destroy();
        inst.stderr.destroy();
      }
    }, timeout);
  }

  inst.on('exit', function(code) {
    completed = true;
    if(timeoutId) clearTimeout(timeoutId);
    inst.on('close', function() {
      if(code === 0) {
        var result = {
          returnCode: code,
          output: combined
        };
        cb(null, result);
      } else {
        var errResult = {
          returnCode: code,
          output: combined
        };
        cb(errResult,null);
      }
    });
  });
};


