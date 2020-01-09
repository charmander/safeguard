VERSION = $(shell node -p 'require("./manifest.json").version')

safeguard-$(VERSION).zip: manifest.json icon.svg icon-light.svg background.html background.js popup/hosts.html popup/hosts.css popup/hosts.js pages/blocked.svg pages/redirect.svg pages/top-level-blocked.html pages/top-level-blocked.css pages/top-level-blocked.js pages/redirect-target.html pages/redirect-target.js pages/list.html pages/list.css pages/list.js util/binary-search.js util/compare-sequences.js util/decode-hex.js util/encode-hex.js
	rm -f $@
	zip $@ $^
