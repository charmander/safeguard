import binarySearch from './binary-search.js';
import compareSequences from './compare-sequences.js';

// Sort siblings next to each other, but don’t separate a (TODO: effective) TLD from the component before.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1315558
const getDomainSort = domain => {
	const components = domain.split('.');
	const suffixCount =
		components.length === 1 ? 0 :
		1;

	for (let i = 0; i < suffixCount; i++) {
		const tail = components.pop();
		components[components.length - 1] += '.' + tail;
	}

	return components.reverse();
};

const associateSelectionActions = (list, buttons) => {
	const updateDisabled = () => {
		const disabled = list.selectedOptions.length === 0;

		buttons.forEach(button => {
			button.disabled = disabled;
		});
	};

	list.addEventListener('change', updateDisabled);
	updateDisabled();
};

const allowList = document.getElementById('allow');
const allowRemove = document.getElementById('allow-remove');
const allowMove = document.getElementById('allow-move');

const redirectList = document.getElementById('redirect');
const redirectRemove = document.getElementById('redirect-remove');
const redirectMove = document.getElementById('redirect-move');

const manageInput = document.getElementById('manage');
const manageNormalized = document.getElementById('manage-normalized');
const manageRedirect = document.getElementById('manage-redirect');
const manageAllow = document.getElementById('manage-allow');
const manageBlock = document.getElementById('manage-block');

associateSelectionActions(allowList, [allowRemove, allowMove]);
associateSelectionActions(redirectList, [redirectRemove, redirectMove]);

allowRemove.addEventListener('click', () => {
	port.postMessage({
		type: 'block',
		hostnames: Array.from(allowList.selectedOptions, option => option.text),
	});
});

allowMove.addEventListener('click', () => {
	port.postMessage({
		type: 'redirect',
		hostnames: Array.from(allowList.selectedOptions, option => option.text),
	});
});

redirectRemove.addEventListener('click', () => {
	port.postMessage({
		type: 'block',
		hostnames: Array.from(redirectList.selectedOptions, option => option.text),
	});
});

redirectMove.addEventListener('click', () => {
	port.postMessage({
		type: 'allow',
		hostnames: Array.from(redirectList.selectedOptions, option => option.text),
	});
});

let normalizedDomain;

const validateManageInput = () => {
	const inputDomain = manageInput.value.trim();
	normalizedDomain = null;

	if (inputDomain !== '' && !/[#?\/\\]/.test(inputDomain)) {
		try {
			const url = new URL(`http://${inputDomain}:80/`);
			normalizedDomain = url.hostname;
		} catch (err) {}
	}

	if (normalizedDomain === null) {
		manageInput.setCustomValidity('not a domain');
		manageNormalized.value = '';

		manageRedirect.disabled = true;
		manageAllow.disabled = true;
		manageBlock.disabled = true;
	} else {
		manageInput.setCustomValidity('');
		manageNormalized.value = '(' + normalizedDomain + ')';

		const option = domainOptions.get(normalizedDomain);
		const parent = option && option.parentNode;

		manageRedirect.disabled = parent === redirectList;
		manageAllow.disabled = parent === allowList;
		manageBlock.disabled = parent === undefined;
	}
};

manageInput.addEventListener('input', validateManageInput);
validateManageInput();

manageRedirect.addEventListener('click', () => {
	port.postMessage({
		type: 'redirect',
		hostnames: [normalizedDomain],
	});

	manageInput.value = '';
	validateManageInput();
});

manageAllow.addEventListener('click', () => {
	port.postMessage({
		type: 'allow',
		hostnames: [normalizedDomain],
	});

	manageInput.value = '';
	validateManageInput();
});

manageBlock.addEventListener('click', () => {
	port.postMessage({
		type: 'block',
		hostnames: [normalizedDomain],
	});

	manageInput.value = '';
	validateManageInput();
});

const optionSorts = new WeakMap();
const domainOptions = new Map();

const createDomainOption = domain => {
	const option = document.createElement('option');
	option.text = domain;
	optionSorts.set(option, getDomainSort(domain));
	domainOptions.set(domain, option);
	return option;
};

const compareOptions = (a, b) =>
	compareSequences(optionSorts.get(a), optionSorts.get(b));

const removeIfExists = hostname => {
	const option = domainOptions.get(hostname);

	if (option === undefined) {
		return null;
	}

	const parent = option.parentNode;
	option.remove();
	domainOptions.delete(hostname);
	return parent;
};

const port = browser.runtime.connect({
	name: 'state',
});

port.onMessage.addListener(message => {
	switch (message.type) {
	case 'state': {
		const { redirect, allow } = message;

		allow.map(createDomainOption)
			.sort(compareOptions)
			.forEach(allowList.appendChild, allowList);

		redirect.map(createDomainOption)
			.sort(compareOptions)
			.forEach(redirectList.appendChild, redirectList);

		break;
	}

	case 'allow':
	case 'redirect':
	case 'block': {
		const { hostnames } = message;
		let allowChanged = false;
		let redirectChanged = false;

		for (const hostname of hostnames) {
			switch (removeIfExists(hostname)) {
			case allowList:
				allowChanged = true;
				break;

			case redirectList:
				redirectChanged = true;
				break;
			}
		}

		const targetList =
			message.type === 'allow' ? (allowChanged = true, allowList) :
			message.type === 'redirect' ? (redirectChanged = true, redirectList) :
			null;

		if (targetList !== null) {
			for (const hostname of hostnames) {
				const option = createDomainOption(hostname);
				const insertIndex = binarySearch(targetList.options, reference => compareOptions(option, reference));

				if (insertIndex === targetList.options.length) {
					targetList.appendChild(option);
				} else {
					targetList.options[insertIndex].before(option);
				}
			}
		}

		if (allowChanged) {
			allowList.dispatchEvent(new Event('change'));
		}

		if (redirectChanged) {
			redirectList.dispatchEvent(new Event('change'));
		}

		validateManageInput();

		break;
	}

	default:
		throw new Error(`Unexpected message type ${message.type}`);
	}
});

port.postMessage({
	type: 'state',
});
