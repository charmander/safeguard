/* exported startup, shutdown, install, uninstall */

'use strict';

Components.utils.import('resource://gre/modules/Services.jsm');

const preferences = Services.prefs.getBranch('extensions.safeguard.');

let whitelist = [];

function reloadWhitelist() {
	whitelist = preferences.getCharPref('whitelist').split(/\s+/);
}

function toggleDomain(domain) {
	if (whitelist.indexOf(domain) === -1) {
		whitelist.push(domain);
		preferences.setCharPref('whitelist', whitelist.join(' '));
	} else {
		preferences.setCharPref('whitelist', whitelist.filter(function (existingDomain) {
			return existingDomain !== domain;
		}).join(' '));
	}
}

function addButton(window) {
	const toolbox = window.document.getElementById('navigator-toolbox');

	if (!toolbox) {
		return;
	}

	const navigationBar = window.document.getElementById('nav-bar');

	let button = window.document.createElement('toolbarbutton');
	button.setAttribute('id', 'safeguard-button');
	button.setAttribute('class', 'toolbarbutton-1 chromeclass-toolbar-additional');
	button.setAttribute('label', 'Safeguard');

	button.addEventListener('command', function toggleCurrentDomain() {
		const uri = window.getBrowser().selectedBrowser.registeredOpenURI;

		if (!uri) {
			return;
		}

		if (uri.schemeIs('http') || uri.schemeIs('https')) {
			toggleDomain(uri.host);
		}
	}, false);

	toolbox.palette.appendChild(button);

	const currentSet = navigationBar.getAttribute('currentset').split(',');
	const i = currentSet.indexOf('safeguard-button');
	let next = null;

	if (i !== -1 && i !== currentSet.length - 1) {
		next = window.document.getElementById(currentSet[i + 1]);
	}

	navigationBar.insertItem('safeguard-button', next);
	window.document.persist('safeguard-button', 'currentset');
}

function removeButton(window) {
	const button = window.document.getElementById('safeguard-button');

	if (button) {
		button.parentNode.removeChild(button);
	}
}

function whenLoaded(window, callback) {
	window.addEventListener('load', function loaded() {
		window.removeEventListener('load', loaded, false);
		callback(window);
	}, false);
}

function eachWindow(callback) {
	const windowEnumerator = Services.wm.getEnumerator('navigator:browser');

	while (windowEnumerator.hasMoreElements()) {
		const domWindow = windowEnumerator.getNext();

		if (domWindow.document.readyState === 'complete') {
			callback(domWindow);
		} else {
			whenLoaded(domWindow, callback);
		}
	}
}

const windowObserver = {
	observe: function observe(subject, topic) {
		if (topic === 'domwindowopened') {
			whenLoaded(subject, addButton);
		}
	}
};

const requestObserver = {
	observe: function observe(subject, topic) {
		if (topic === 'http-on-modify-request') {
			const request = subject.QueryInterface(Components.interfaces.nsIHttpChannel);

			if (request.URI.scheme === 'http' && whitelist.indexOf(request.URI.host) === -1) {
				request.URI.scheme = 'https';
				request.redirectTo(request.URI);
			}
		}
	}
};

function startup() {
	Services.prefs
		.getDefaultBranch('extensions.safeguard.')
		.setCharPref('whitelist', '');

	reloadWhitelist();

	preferences.addObserver('whitelist', reloadWhitelist, false);
	Services.obs.addObserver(requestObserver, 'http-on-modify-request', false);

	Services.ww.registerNotification(windowObserver);
	eachWindow(addButton);
}

function shutdown() {
	Services.obs.removeObserver(requestObserver, 'http-on-modify-request');
	preferences.removeObserver('whitelist', reloadWhitelist);

	Services.ww.unregisterNotification(windowObserver);
	eachWindow(removeButton);
}

function install() {
}

function uninstall() {
}
