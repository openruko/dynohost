var async = require('async');
var DynoStateMachine = require('./dynocontroller');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var async = require('async');
var conf = require('./conf');
var apiBaseUrl = require('url').format(conf.apiserver) + '/';

var dynos = {};

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
    }, pollForJobs, function() { });
    self.emit('ready');
  };

  function pollForJobs(cb) {
    var url = apiBaseUrl + 'internal/getjobs';
    request(url, function(err, resp, body) {
      if(err) {
        console.error('Unable to fetch jobs from ' + url);
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
    var requestInfo = {
      method: 'POST',
      url: apiBaseUrl + 'internal/updatestate',
      headers: {
        'Authorization': ' Basic ' + 
          new Buffer(':' + conf.apiserver.key).toString('base64')
      },
      json: true,
      body: payload
    };

    request(requestInfo, function(err, resp, body) {
      cb();
    });
  };

  var stateUpdateQueue = async.queue(updateState,1);

  this.process = function(job, cb) {
    var dyno;

    if(job.next_action == 'start') {
      dyno=new DynoStateMachine(job);
      dynos[dyno.id] = dyno;
      dyno.on('stateChanging', function(state) {
        stateUpdateQueue.push({
          dynoId: job.dyno_id,
          instanceId: job.instance_id,
          state: state,
          appId: job.app_id
        });
      });
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

