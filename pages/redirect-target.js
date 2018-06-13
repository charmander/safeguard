'use strict';

const params = new URLSearchParams(window.location.search);

const port = browser.runtime.connect();

port.postMessage({
	url: params.get('url'),
	hmac: params.get('hmac'),
});
