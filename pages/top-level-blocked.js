// window.location.replace doesn’t work
const locationReplace = async newUrl => {
	const { id } = await browser.tabs.getCurrent();

	browser.tabs.update(id, {
		url: newUrl,
		loadReplace: true,
	});
};

const url = new URLSearchParams(window.location.search).get('url');
const hostname = new URL(url).hostname;

const port = browser.runtime.connect({
	name: 'state',
});

port.postMessage({
	type: 'check',
	hostname,
});

port.onMessage.addListener(message => {
	switch (message.type) {
	case 'exists':
		port.disconnect();
		locationReplace(url);
		break;

	default:
		throw new Error(`Unexpected message type ${message.type}`);
	}
});

document.getElementById('url').textContent = url;
document.getElementById('domain').textContent = hostname;

const allowButton = document.getElementById('allow');
const redirectButton = document.getElementById('redirect');
const save = document.getElementById('save');

allowButton.addEventListener('click', () => {
	if (save.checked) {
		port.postMessage({
			type: 'allow',
			hostnames: [hostname],
		});
	} else {
		port.postMessage({
			type: 'allow-temporary',
			url,
		});
	}

	locationReplace(url);
});

redirectButton.addEventListener('click', () => {
	if (save.checked) {
		port.postMessage({
			type: 'redirect',
			hostnames: [hostname],
		});
	}

	const httpsUrl = new URL(url);
	httpsUrl.protocol = 'https:';
	locationReplace(httpsUrl.href);
});

allowButton.disabled = false;
redirectButton.disabled = false;
