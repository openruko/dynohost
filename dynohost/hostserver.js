var async = require('async');
var DynoStateMachine = require('./dynocontroller');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var async = require('async');
var conf = require('./conf');
var apiBaseUrl = require('url').format(conf.apiserver) + '/';
var fs = require('fs');
var _ = require('underscore');

var dynos = {};

var requestDefault = {
  strictSSL: conf.apiserver.ssl_verify,
  headers: {
    'Authorization': ' Basic ' +
      new Buffer(':' + conf.apiserver.key).toString('base64')
  }
}

module.exports.createServer = function(options) {
  options = options || {};
  var inst =  new DynoHostServer();
  return inst;
};

module.exports.getDyno = function(dynoId) {
  return dynos[dynoId];
};

DynoHostServer.prototype = new EventEmitter();

function DynoHostServer() {

  var self = this;
  var isStopping = false;

  this.start  = function() {
    async.whilst(function() {
      return !isStopping;
    }, pollForJobs, function() { process.exit(); });
    self.emit('ready');
  };

  function pollForJobs(cb) {
    var requestInfo = _.extend(requestDefault, {
      method: 'GET',
      url: apiBaseUrl + 'internal/getjobs',
    });

    request(requestInfo, function(err, resp, body) {
      if(err) {
        console.error('Unable to fetch jobs from ' + requestInfo["url"] + '. Error: ' + err.message);
        return setTimeout(cb, 1000);
      }

      var payload = JSON.parse(body);
      payload.forEach(function(job) {
        console.log(job.dyno_id + ' - Incoming new job: ' + job.next_action);
        self.process(job, function() { });
      });

      cb();
    });
  }

  this.getDyno = function(dynoId) {
    return dynos[dynoId];
  };

  var updateState = function(payload, cb) {
    console.log(payload.dynoId +
                ' - Update api server with state: ' + payload.state);
    var requestInfo = _.extend(requestDefault, {
      method: 'POST',
      url: apiBaseUrl + 'internal/updatestate',
      json: true,
      body: payload
    });

    request(requestInfo, function(err, resp, body) {
      cb();
    });
  };

  var stateUpdateQueue = async.queue(updateState,1);

  var incrementHeartbeat = function(payload, cb) {
    var requestInfo = _.extend(requestDefault, {
      method: 'POST',
      url: apiBaseUrl + 'internal/incrementHeartbeat',
      json: true,
      body: payload
    });

    request(requestInfo, function(err, resp, body) {
      cb();
    });
  };
  //Not sure why this queue is needed? @tombh
  var incrementHeartbeatQueue = async.queue(incrementHeartbeat, 1);

  this.process = function(job, cb) {
    var dyno;

    if(job.next_action == 'start') {
      dyno=new DynoStateMachine(job);
      dynos[dyno.id] = dyno;
      dyno.on('stateChanging', function(state) {
        stateUpdateQueue.push({
          dynoId: job.dyno_id,
          dynoHostname: job.dyno_hostname,
          instanceId: job.instance_id,
          state: state,
          appId: job.app_id,
          port: dyno.port
        });
      });

      // Keep track of the app's accumulated uptime across all instances.
      // The instance ID is used to reference the app ID so that uptime is kept on the app table.
      if(job.instance_id){
        dyno.on('heartbeat', function() {
          incrementHeartbeatQueue.push({
            instanceId: job.instance_id
          });
        });
      }

      dyno.start();
      return dyno;
    }

    if(job.next_action === 'kill') {
      dyno = dynos[job.dyno_id];
      if(dyno) {
        dyno.stop();
      }
    }
  };

  this.shutdown = function() {
    isStopping = true;
  };

}

