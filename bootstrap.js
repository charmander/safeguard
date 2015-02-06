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
	function toggleCurrentDomain() {
		const uri = window.getBrowser().selectedBrowser.registeredOpenURI;

		if (!uri) {
			return;
		}

		if (uri.schemeIs('http') || uri.schemeIs('https')) {
			toggleDomain(uri.host);
		}
	}

	window.CustomizableUI.createWidget({
		id: 'safeguard-button',
		type: 'button',
		tooltiptext: 'Toggle Safeguard whitelist entry for current domain',
		label: 'Safeguard',
		onCommand: toggleCurrentDomain,
	});
}

function removeButton(window) {
	window.CustomizableUI.destroyWidget('safeguard-button');
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
