.PHONY: init certs

init:
	mkdir -p assets/
	mkdir -p sockets/
	@echo "Download buildpack"
	curl -s -o assets/buildpacks.tgz https://buildkits.herokuapp.com/buildkit/default.tgz
	mkdir -p assets/buildpacks/
	tar xzf assets/buildpacks.tgz -C assets/buildpacks/
	mkdir assets/emptyrepo
	git init --bare assets/emptyrepo
	@echo "Install npm modules"
	npm install .
	@echo "Optionally run make certs to generate test certs"
	sudo mount -o bind templates /usr/lib/lxc/templates
	sudo lxc-create -t openrutu -n openrutu-model
	sudo umount /usr/lib/lxc/templates

certs: 
	mkdir -p certs/
	openssl req -x509 -nodes -days 365 -newkey rsa:1024 -keyout certs/server.pem -out certs/server.pem


