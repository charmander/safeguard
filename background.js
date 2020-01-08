'use strict';

const MAX_RECENT_HOSTS = 20;

let redirect;
let allow;
const ready = browser.storage.local.get().then(s => {
	redirect = new Set(s.redirect);
	allow = new Set(s.allow);
});

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

		await ready;

		if (redirect.has(hostname)) {
			return { upgradeToSecure: true };
		}

		if (allow.has(hostname) || temporaryAllow.has(request.url)) {
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

const updateStorage = ({ updateAllow, updateRedirect }) => {
	const updates = {};

	if (updateAllow) {
		updates.allow = Array.from(allow);
	}

	if (updateRedirect) {
		updates.redirect = Array.from(redirect);
	}

	return browser.storage.local.set(updates);
};

const stateListeners = new Set();

const postStateMessage = message => {
	for (const listener of stateListeners) {
		listener.postMessage(message);
	}
};

const onStateDisconnect = port => {
	stateListeners.delete(port);
};

const onStateMessage = async (message, port) => {
	await ready;

	switch (message.type) {
	case 'state': {
		port.postMessage({
			type: 'state',
			redirect: Array.from(redirect),
			allow: Array.from(allow),
		});
		stateListeners.add(port);
		port.onDisconnect.addListener(onStateDisconnect);
		break;
	}

	case 'recent':
		port.postMessage({
			type: 'recent',
			recent: Array.from(recent)
				.reverse()
				.map(hostname => ({
					name: hostname,
					state:
						redirect.has(hostname) ? 'redirect' :
						allow.has(hostname) ? 'allow' :
						'block',
				})),
		});
		break;

	case 'check': {
		const { hostname } = message;

		if (redirect.has(hostname) || allow.has(hostname)) {
			port.postMessage({
				type: 'exists',
			});
			port.disconnect();
		}

		break;
	}

	case 'allow': {
		const { hostnames } = message;
		let updateRedirect = false;

		for (const hostname of hostnames) {
			updateRedirect |= redirect.delete(hostname);
			allow.add(hostname);
		}

		updateStorage({
			updateAllow: true,
			updateRedirect,
		});

		postStateMessage(message);

		break;
	}

	case 'allow-temporary':
		temporaryAllow.add(message.url);
		break;

	case 'redirect': {
		const { hostnames } = message;
		let updateAllow = false;

		for (const hostname of hostnames) {
			updateAllow |= allow.delete(hostname);
			redirect.add(hostname);
		}

		updateStorage({
			updateAllow,
			updateRedirect: true,
		});

		postStateMessage(message);

		break;
	}

	case 'block': {
		const { hostnames } = message;
		let updateAllow = false;
		let updateRedirect = false;

		for (const hostname of hostnames) {
			updateAllow |= allow.delete(hostname);
			updateRedirect |= redirect.delete(hostname);
		}

		updateStorage({
			updateAllow,
			updateRedirect,
		});

		postStateMessage(message);

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
