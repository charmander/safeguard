VERSION = $(shell node -p 'require("./manifest.json").version')

safeguard-$(VERSION).zip: manifest.json icon.svg icon-light.svg background.js popup/hosts.html popup/hosts.css popup/hosts.js pages/blocked.svg pages/redirect.svg pages/top-level-blocked.html pages/top-level-blocked.css pages/top-level-blocked.js pages/redirect-target.html pages/redirect-target.js
	rm -f $@
	zip $@ $^
