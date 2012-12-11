var Path = require('path');
var child_process = require('child_process');
var chai = require('chai-stack');
var expect = chai.expect;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var DynoController = require('../dynohost/dynocontroller');
var rukorunMock = require('./mock/rukorun');
var conf = require('../dynohost/conf');

var socketPath = conf.dynohost.socketPath;

describe('dynocontroller', function(){
  var dynoController;
  beforeEach(function(done){
    rimraf(socketPath, function(err){
      if(err) return done(err);
      mkdirp(socketPath, function(err){
        if(err) return done(err);
        dynoController = new DynoController({
          dyno_id: 123,
          logplex_id: 'logplex-test-123',
          attached: false,
          pty: false,
          command: 'node',
          command_args: ['server.js'],
          template: 'build',
          mounts: [],
          env_vars: {
          }
        });
        done();
      });
    });
  });

  describe('when rukorun listen to the sockets', function(){
    beforeEach(rukorunMock.connectToSockets);
    afterEach(rukorunMock.closeSockets);

    it('should emits different states', function(done){
      var states = [];
      dynoController.on('stateChanging', function(state){
        states.push(state);
      });
      setTimeout(function(){
        expect(states).to.be.deep.equal(['listening', 'running']);
        done();
      }, 20);
    });
  });
});
