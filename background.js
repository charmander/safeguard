'use strict';

const MAX_RECENT_HOSTS = 20;

const settings = browser.storage.local.get();
const redirect = settings.then(s => new Set(s.redirect));
const allow = settings.then(s => new Set(s.allow));
const temporaryAllow = new Set();
const recent = new Set();

const first = collection =>
	collection.values().next().value;

browser.webRequest.onBeforeRequest.addListener(
	async request => {
		const target = new URL(request.url);
		const hostname = target.hostname;

		recent.delete(hostname);

		if (recent.size === MAX_RECENT_HOSTS) {
			recent.delete(first(recent));
		}

		recent.add(hostname);

		if ((await redirect).has(hostname)) {
			return { upgradeToSecure: true };
		}

		if ((await allow).has(hostname) || temporaryAllow.has(request.url)) {
			temporaryAllow.delete(request.url);
			return {};
		}

		if (request.type === 'main_frame' && request.tabId !== -1 && request.method === 'GET') {
			browser.tabs.update({
				url: '/pages/top-level-blocked.html?url=' + encodeURIComponent(request.url),
				loadReplace: true,
			});
		}

		return { cancel: true };
	},
	{ urls: ['http://*/*'] },
	['blocking'],
);

(async () => {
	window.redirect = await redirect;
	window.allow = await allow;
	window.recent = recent;
	window.temporaryAllow = temporaryAllow;

	browser.browserAction.setPopup({
		popup: 'popup/hosts.html',
	});
})();
