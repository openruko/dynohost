# DynoHost - Hypervisor for dynos

## Introduction

Dynohost is a small host controller written in node.js that provisions, proxies
communications, and handle state changes of its dyno guests. It runs on each node
that will host dynos, it calls into the API server periodically to pick up new
jobs and reports status changes back to the API server's restful interface. 

## Requirements

Tested on Linux 3.2 using nodejs 0.8

On a fresh Ubuntu 12.04 LTS instance:  
```
apt-get install lxc
apt-get install curl
apt-get install nodejs
```

Please share experiences with CentOS, Fedora etc.. as dynohost has a direct dependency
on LXC (Linux lightweight containers) it will **not** work on non Linux systems. There
could be future scope to extend the system to work with Solaris zones, or FreeBSD jails,
or even other virtualization technologies like Xen, KVM and OpenVZ however this has 
not yet been considered.

## Installation

```
git clone https://github.com/openruko/dynohost.git dynohost  
```

Install nodejs dependencies
```
make init
```

Setup temporary openssl certs:
```
make certs
```

## Environment Variables

dynhost/bin/dynohost will check for the presence of several environment variables,
these must be configured as part of the process start - e.g. configured in 
supervisord or as part of boot script see ./debug.launch for example

* KEY_AUTH_BASE_URL - base url of the API server (example: http://localhost:5000/)  
* API_SERVER_SUPERUSER_- special key to authenticate with API server (example: KEY=abcdef-342131-123123123-asdasd)
* PORT - TCP port to bind server to (<1024 require superuser privileges)
* PRIVATE_KEY - Path to private key (can be relative to project root)
* PUBLIC_KEY - Path to public key (can be relative to project root)
* RUKORUN_PATH - Path to rukorun directory
* CODONHOOKS_PATH - Path to codon hooks directory


## Help and Todo 

There are some instances where resources arent cleaned up, in some cases I 
observed lxc container being unresponsive to stop and destroy, I need to confirm 
that this is lxc issue or my code, the latter is more likely. 

## License

dynohost and other openruko components are licensed under MIT.  
[http://opensource.org/licenses/mit-license.php](http://opensource.org/licenses/mit-license.php)

## Authors and Credits

Matt Freeman  
[email me - im looking for some remote work](mailto:matt@nonuby.com)  
[follow me on twitter](http://www.twitter.com/nonuby )
