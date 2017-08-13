'use strict';

const hostTemplate = document.getElementById('host-template').content.firstElementChild;

const closest = (className, node) => {
	while (node && !node.classList.contains(className)) {
		node = node.parentNode;
	}

	return node;
};

const createHost = (host, i) => {
	const element = document.importNode(hostTemplate, true);
	element.dataset.hostname = host.name;
	element.getElementsByClassName('hostname')[0].textContent = host.name;

	for (const action of element.getElementsByClassName('action')) {
		const input = action.getElementsByTagName('input')[0];
		input.name = `action_${i}`;
		input.checked = input.value === host.state;
	}

	return element;
};

const { recent, redirect, allow } = browser.extension.getBackgroundPage();
const recentContainer = document.getElementById('recent');
const emptyMessage = document.getElementById('empty');

recentContainer.addEventListener('change', e => {
	if (!e.target.checked) {
		return;
	}

	const hostElement = closest('host', e.target);
	const hostname = hostElement.dataset.hostname;

	const updates = {};

	if (redirect.delete(hostname)) {
		updates.redirect = redirect;
	}

	if (allow.delete(hostname)) {
		updates.allow = allow;
	}

	switch (e.target.value) {
	case 'redirect':
		redirect.add(hostname);
		updates.redirect = redirect;
		break;

	case 'allow':
		allow.add(hostname);
		updates.allow = allow;
		break;
	}

	browser.storage.local.set(updates);
});

Array.from(recent)
	.reverse()
	.map(hostname => ({
		name: hostname,
		state:
			redirect.has(hostname) ? 'redirect' :
			allow.has(hostname) ? 'allow' :
			'block',
	}))
	.map(createHost)
	.forEach(Element.prototype.appendChild, recentContainer);

emptyMessage.hidden = recent.size !== 0;
