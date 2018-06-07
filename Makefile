VERSION = $(shell node -p 'require("./manifest.json").version')

safeguard-$(VERSION).zip: manifest.json icon.svg background.js popup/hosts.html popup/hosts.css popup/hosts.js pages/blocked.svg pages/top-level-blocked.html pages/top-level-blocked.css pages/top-level-blocked.js
	rm -f $@
	zip $@ $^
