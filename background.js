'use strict';

const MAX_RECENT_HOSTS = 20;

const settings = browser.storage.local.get();
const redirect = settings.then(s => s.redirect || new Set());
const allow = settings.then(s => s.allow || new Set());
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
			target.protocol = 'https:';
			return { redirectUrl: target.href };
		}

		return {
			cancel: !(await allow).has(hostname),
		};
	},
	{ urls: ['http://*/*'] },
	['blocking'],
);

(async () => {
	window.redirect = await redirect;
	window.allow = await allow;
	window.recent = recent;

	browser.browserAction.setPopup({
		popup: 'popup/hosts.html',
	});
})();
