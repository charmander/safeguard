'use strict';

(() => {
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

	const { redirect, allow, temporaryAllow } = browser.extension.getBackgroundPage();

	if (redirect.has(hostname) || allow.has(hostname)) {
		locationReplace(url);
		return;
	}

	document.getElementById('url').textContent = url;
	document.getElementById('domain').textContent = hostname;

	const allowButton = document.getElementById('allow');
	const redirectButton = document.getElementById('redirect');
	const save = document.getElementById('save');

	allowButton.addEventListener('click', () => {
		if (save.checked) {
			const updates = {};

			if (redirect.delete(hostname)) {
				updates.redirect = Array.from(redirect);
			}

			allow.add(hostname);
			updates.allow = Array.from(allow);

			browser.storage.local.set(updates);
		} else {
			temporaryAllow.add(url);
		}

		locationReplace(url);
	});

	redirectButton.addEventListener('click', () => {
		if (save.checked) {
			const updates = {};

			if (allow.delete(hostname)) {
				updates.allow = Array.from(allow);
			}

			redirect.add(hostname);
			updates.redirect = Array.from(redirect);

			browser.storage.local.set(updates);
		}

		const httpsUrl = new URL(url);
		httpsUrl.protocol = 'https:';
		locationReplace(httpsUrl.href);
	});

	allowButton.disabled = false;
	redirectButton.disabled = false;
})();
