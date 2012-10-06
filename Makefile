.PHONY: init certs

init:
	mkdir -p assets/
	mkdir -p sockets/
	@echo "Download buildpack"
	curl -o assets/buildpacks.tgz https://buildkits.herokuapp.com/buildkit/default.tgz 
	touch assets/emptyrepo.tar 
	gzip assets/emptyrepo.tar
	@echo "Install npm modules"
	npm install .
	@echo "Optionally run make certs to generate test certs"

certs: 
	mkdir -p certs/
	openssl req -x509 -nodes -days 365 -newkey rsa:1024 -keyout certs/server.pem -out certs/server.pem


