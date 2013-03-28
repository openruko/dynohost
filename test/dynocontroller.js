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
          dyno_id: "123",
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

  describe('when starting the dyno', function(){

    var instructions;
    beforeEach(function(done){
      instructions = [];
      //mock the syncExecute function
      dynoController.syncExecute = function(instruction, cb, timeout){
        instructions.push(instruction);
        cb(null, {
          returnCode: 0,
          output: "Hello"
        });
      };
      dynoController.afterStartTimeout = 300;
      dynoController.cleanUpTimeout = 300;
      dynoController.start();
      done();
    });

    it('should change its state to `starting`', function(done){
      dynoController.once('stateChanging', function(state){
        expect(state).to.be.equal('starting');
        done();
      });
    });

    it('should start a provision script', function(done){
      setTimeout(function(){
        expect(instructions).to.have.length(1);
        expect(instructions[0].command).to.be.equal('/bin/bash');
        expect(instructions[0].args).to.be.deep.equal([
          'dynohost/scripts/build-provision',
          "123",
          '/tmp/sockets/123',
          '/tmp/sockets/123'
        ]);
        done();
      }, 20);
    });

    describe('when rukorun does not listen to the sockets', function(){
      beforeEach(function(done){
        setTimeout(done, 250);
      });

      it('should change its state to `errored`', function(done){
        dynoController.once('stateChanging', function(state){
          expect(state).to.be.equal('errored');
          done();
        });
      });
    });

    describe('when rukorun listen to the sockets', function(){
      beforeEach(rukorunMock.connectToSockets);
      afterEach(rukorunMock.closeSockets);

      it('should change its state to `listening` and then to `running`', function(done){
        dynoController.once('stateChanging', function(state){
          expect(state).to.be.equal('listening');

          dynoController.once('stateChanging', function(state){
            expect(state).to.be.equal('running');
            done();
          });
        });
      });

      it('should send `do` command to rukorun', function(done){
        rukorunMock.sockets.command.once('data', function(data){
          data = JSON.parse(data);
          expect(data.type).to.be.equal('do');
          expect(data.attached).to.be.false;
          expect(data.pty).to.be.false;
          expect(data.command).to.be.equal('node');
          expect(data.args).to.be.deep.equal(['server.js']);
          expect(data.env_vars.PORT).to.exist;
          done();
        });
      });

      describe('given a running dyno', function(){
        beforeEach(function(done){
          rukorunMock.sockets.command.once('data', function(){ 
            done();
          });
        });

        describe('when the dyno send an exit message', function(){
          beforeEach(function(done){
            rukorunMock.sockets.command.write(JSON.stringify({
              type: 'exit',
              code: 1234,
              message: 'Exit'
            }) + '\n');
            done();
          });

          it('should change its state to `completed`', function(done){
            dynoController.once('stateChanging', function(state){
              expect(state).to.be.equal('completed');
              done();
            });
          });

          it('should send `stop` command to rukorun', function(done){
            rukorunMock.sockets.command.once('data', function(data){
              data = JSON.parse(data.toString());
              expect(data.type).to.be.equal('stop');
              done();
            });
          });

          describe('When the socket are destroyed', function(){
            beforeEach(function(done){
              setTimeout(function(){
                rukorunMock.closeSockets(done);
              }, 20);
            });

            it('should execute one cleanup script', function(done){
              setTimeout(function(){
                expect(instructions).to.have.length(2);
                expect(instructions[1].command).to.be.equal('/bin/bash');
                expect(instructions[1].args).to.be.deep.equal([
                  'dynohost/scripts/cleanup',
                  "123"
                ]);
                done();
              }, 20);
            });
          });

          describe('Even if the sockets are not destroyed', function(done){
            beforeEach(function(done){
              setTimeout(done, 310);
            });

            it('should execute a cleanup script after cleanupTimeout', function(done){
              expect(instructions).to.have.length(2);
              expect(instructions[1].args).to.be.deep.equal([
                'dynohost/scripts/cleanup',
                "123"
              ]);
              done();
            });
          });
        });

        describe('when api server stop a dyno', function(){
          beforeEach(function(done){
            dynoController.stop();
            done();
          });

          it('should send `stop` command to rukorun', function(done){
            rukorunMock.sockets.command.once('data', function(data){
              data = JSON.parse(data.toString());
              expect(data.type).to.be.equal('stop');
              done();
            });
          });
        });
      });
    });
  });
});
