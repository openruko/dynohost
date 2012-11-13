.PHONY: init certs

init:
	mkdir -p assets/
	mkdir -p sockets/
	@echo "Download buildpack"
	curl -o assets/buildpacks.tgz https://buildkits.herokuapp.com/buildkit/default.tgz 
	mkdir assets/emptyrepo
	git init --bare assets/emptyrepo
	tar czf assets/emptyrepo.tgz -C assets/emptyrepo .
	rm -fr assets/emptyrepo
	@echo "Install npm modules"
	npm install .
	@echo "Optionally run make certs to generate test certs"

certs: 
	mkdir -p certs/
	openssl req -x509 -nodes -days 365 -newkey rsa:1024 -keyout certs/server.pem -out certs/server.pem


