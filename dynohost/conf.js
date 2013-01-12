var env = process.env;

['APISERVER_KEY', 'RUKORUN_PATH', 'CODONHOOKS_PATH'].forEach(function(envKey) {
  if(!env[envKey]) {
    throw new Error('Environment variables ' + envKey + ' must be defined.');
  }
});

module.exports = {
  dynohost: {
    privateKey: env.DYNOHOST_PRIVATE_KEY || 'certs/server.pem',
    publicKey: env.DYNOHOST_PUBLIC_KEY || 'certs/server.pem',
    socketPath: env.DYNOHOST_SOCKET_PATH || '/tmp/sockets',
    rendezvous: {
      port: env.DYNOHOST_RENDEZVOUS_PORT || 4000,
    }
  },
  apiserver: {
    protocol: env.APISERVER_PROTOCOL || 'https',
    hostname: env.APISERVER_HOST || 'localhost',
    port: env.APISERVER_PORT || 5000,
    key: env.APISERVER_KEY
  },
  logplex: {
    hostname: env.LOGPLEX_HOST || 'localhost',
    webPort: env.LOGPLEX_WEB_PORT || 9996,
    udpPort: env.LOGPLEX_UDP_PORT || 9999
  },
  rukorun: {
    path: env.RUKORUN_PATH
  },
  codonhooks: {
    path: env.CODONHOOKS_PATH
  }
}
