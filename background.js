'use strict';

const MAX_RECENT_HOSTS = 20;

const settings = browser.storage.local.get();
const redirect = settings.then(s => new Set(s.redirect));
const allow = settings.then(s => new Set(s.allow));
const temporaryAllow = new Set();
const recent = new Set();

const first = collection =>
	collection.values().next().value;

const signingKey = crypto.subtle.generateKey(
	{ name: 'HMAC', hash: 'SHA-256' },
	false,
	['sign', 'verify']
);

const encodeByteHex = byte => byte.toString(16).padStart(2, '0');

const encodeHex = arrayBuffer =>
	Array.prototype.map.call(new Uint8Array(arrayBuffer), encodeByteHex).join('');

const decodeHex = hex => {
	const bytes = new Uint8Array(hex.length >>> 1);

	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(2 * i, 2), 16);
	}

	return bytes;
};

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
			const urlBytes = new TextEncoder('utf-8').encode(request.url);
			const hmac = await crypto.subtle.sign('HMAC', await signingKey, urlBytes);
			const blockRedirectPage =
				'/pages/redirect-target.html?url=' + encodeURIComponent(request.url) +
				                           '&hmac=' + encodeHex(hmac);

			return { redirectUrl: browser.runtime.getURL(blockRedirectPage) };
		}

		return { cancel: true };
	},
	{ urls: ['http://*/*'] },
	['blocking'],
);

const onRedirectTargetMessage = async (message, port) => {
	port.disconnect();

	const urlBytes = new TextEncoder('utf-8').encode(message.url);
	const hmac = decodeHex(message.hmac);
	const valid = await crypto.subtle.verify('HMAC', await signingKey, hmac, urlBytes);

	if (valid) {
		const blockPage = '/pages/top-level-blocked.html?url=' + encodeURIComponent(message.url);

		browser.tabs.update(port.sender.tab.id, {
			url: blockPage,
			loadReplace: true,
		});
	}
};

const onStateMessage = async (message, port) => {
	switch (message.type) {
	case 'recent': {
		const redirectS = await redirect;
		const allowS = await allow;

		port.postMessage({
			type: 'recent',
			recent: Array.from(recent)
				.reverse()
				.map(hostname => ({
					name: hostname,
					state:
						redirectS.has(hostname) ? 'redirect' :
						allowS.has(hostname) ? 'allow' :
						'block',
				})),
		});
		break;
	}

	case 'check': {
		const { hostname } = message;

		if ((await redirect).has(hostname) || (await allow).has(hostname)) {
			port.postMessage({
				type: 'exists',
			});
			port.disconnect();
		}

		break;
	}

	case 'allow': {
		const { hostname } = message;
		const updates = {};

		if ((await redirect).delete(hostname)) {
			updates.redirect = Array.from(await redirect);
		}

		(await allow).add(hostname);
		updates.allow = Array.from(await allow);

		browser.storage.local.set(updates);

		break;
	}

	case 'allow-temporary':
		temporaryAllow.add(message.url);
		break;

	case 'redirect': {
		const { hostname } = message;
		const updates = {};

		if ((await allow).delete(hostname)) {
			updates.allow = Array.from(await allow);
		}

		(await redirect).add(hostname);
		updates.redirect = Array.from(await redirect);

		browser.storage.local.set(updates);

		break;
	}

	case 'block': {
		const { hostname } = message;
		const updates = {};

		if ((await allow).delete(hostname)) {
			updates.allow = Array.from(await allow);
		} else if ((await redirect).delete(hostname)) {
			updates.redirect = Array.from(await redirect);
		}

		browser.storage.local.set(updates);

		break;
	}

	default:
		throw new Error(`Unexpected message type ${message.type}`);
	}
};

browser.runtime.onConnect.addListener(port => {
	switch (port.name) {
	case 'redirect-target':
		port.onMessage.addListener(onRedirectTargetMessage);
		break;

	case 'state':
		port.onMessage.addListener(onStateMessage);
		break;

	default:
		throw new Error(`Unexpected connection ${port.name}`);
	}
});

browser.browserAction.setPopup({
	popup: 'popup/hosts.html',
});
