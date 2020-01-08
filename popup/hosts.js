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

const port = browser.runtime.connect({
	name: 'state',
});

const recentContainer = document.getElementById('recent');
const emptyMessage = document.getElementById('empty');

recentContainer.addEventListener('change', e => {
	if (!e.target.checked) {
		return;
	}

	const hostElement = closest('host', e.target);
	const hostname = hostElement.dataset.hostname;

	port.postMessage({
		type: e.target.value,
		hostname,
	});
});

port.onMessage.addListener(message => {
	switch (message.type) {
	case 'recent': {
		const { recent } = message;

		for (const entry of recent) {
			recentContainer.append(createHost(entry));
		}

		emptyMessage.textContent = 'No recent hosts.';
		emptyMessage.hidden = recent.length !== 0;

		break;
	}

	default:
		throw new Error(`Unexpected message type ${message.type}`);
	}
});

port.postMessage({
	type: 'recent',
});
