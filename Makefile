VERSION = $(shell node -p 'require("./manifest.json").version')

safeguard-$(VERSION).zip: manifest.json icon.svg background.js popup/hosts.html popup/hosts.css popup/hosts.js
	rm -f $@
	zip $@ $^
