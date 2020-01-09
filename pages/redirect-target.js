const params = new URLSearchParams(window.location.search);

const port = browser.runtime.connect({
	name: 'redirect-target',
});

port.postMessage({
	url: params.get('url'),
	hmac: params.get('hmac'),
});
port.disconnect();
