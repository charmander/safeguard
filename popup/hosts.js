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
const prefsLink = document.getElementById('prefs');
const clearButton = document.getElementById('clear');

recentContainer.addEventListener('change', e => {
	if (!e.target.checked) {
		return;
	}

	const hostElement = closest('host', e.target);
	const hostname = hostElement.dataset.hostname;

	port.postMessage({
		type: e.target.value,
		hostnames: [hostname],
	});
});

prefsLink.addEventListener('click', () => {
	browser.runtime.openOptionsPage();
});

clearButton.addEventListener('click', () => {
	port.postMessage({
		type: 'clear-recent',
	});

	recentContainer.textContent = '';
	emptyMessage.hidden = false;
	clearButton.disabled = true;
});

port.onMessage.addListener(message => {
	switch (message.type) {
	case 'recent': {
		const { recent } = message;

		for (const [i, entry] of recent.entries()) {
			recentContainer.append(createHost(entry, i));
		}

		emptyMessage.textContent = 'No recent hosts.';
		emptyMessage.hidden = recent.length !== 0;
		clearButton.disabled = recent.length === 0;

		break;
	}

	/*case 'allow':
	case 'redirect':
	case 'block':
		// TODO: implement this, but with storage change event after storage refactoring
		break;*/

	default:
		throw new Error(`Unexpected message type ${message.type}`);
	}
});

port.postMessage({
	type: 'recent',
});
