/* exported startup, shutdown, install, uninstall */

'use strict';

Components.utils.import('resource://gre/modules/Services.jsm');

const windowMediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);

const preferences = Components.classes['@mozilla.org/preferences-service;1']
	.getService(Components.interfaces.nsIPrefService)
	.getBranch('extensions.safeguard.');

let whitelist = [];

function reloadWhitelist() {
	whitelist = preferences.getCharPref('whitelist').split(/\s+/);
}

function addButton(window) {
	window.addEventListener('load', function loaded() {
		window.removeEventListener('load', loaded, false);

		const toolbox = window.document.getElementById('navigator-toolbox');

		if (!toolbox) {
			return;
		}

		const navigationBar = window.document.getElementById('nav-bar');

		let button = window.document.getElementById('safeguard-button');

		if (!button) {
			button = window.document.createElement('toolbarbutton');
			button.setAttribute('id', 'safeguard-button');
			button.setAttribute('class', 'toolbarbutton-1 chromeclass-toolbar-additional');
			button.setAttribute('label', 'Safeguard');

			button.addEventListener('click', reloadWhitelist, false);

			toolbox.palette.appendChild(button);
		}

		navigationBar.insertItem('safeguard-button');
	}, false);
}

function removeButton(window) {
	const button = window.document.getElementById('safeguard-button');

	if (button) {
		button.parentNode.removeChild(button);
	}
}

function getDOMWindow(windowComponent) {
	return windowComponent.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowInternal || Components.interfaces.nsIDOMWindow);
}

function* windows() {
	const windowEnumerator = windowMediator.getEnumerator('navigator:browser');

	while (windowEnumerator.hasMoreElements()) {
		const windowComponent = windowEnumerator.getNext();
		const domWindow = getDOMWindow(windowComponent);
		yield domWindow;
	}
}

const windowListener = {
	onOpenWindow: function (windowComponent) {
		const domWindow = getDOMWindow(windowComponent);
		addButton(domWindow);
	},
	onCloseWindow: function () {},
	onWindowTitleChange: function () {}
};

const observer = {
	observe: function observe(subject, topic, data) {
		if (topic === 'http-on-modify-request') {
			const request = subject.QueryInterface(Components.interfaces.nsIHttpChannel);

			if (request.URI.scheme === 'http' && whitelist.indexOf(request.URI.host) === -1) {
				request.URI.scheme = 'https';
				request.redirectTo(request.URI);
			}
		}
	}
};

function startup(data, reason) {
	reloadWhitelist();

	Services.obs.addObserver(observer, 'http-on-modify-request', false);

	windowMediator.addListener(windowListener);

	for (let domWindow of windows()) {
		addButton(domWindow);
	}
}

function shutdown(data, reason) {
	Services.obs.removeObserver(observer, 'http-on-modify-request');

	windowMediator.removeListener(windowListener);

	for (let domWindow of windows()) {
		removeButton(domWindow);
	}
}

function install(data, reason) {
	Components.classes['@mozilla.org/preferences-service;1']
		.getService(Components.interfaces.nsIPrefService)
		.getDefaultBranch('extensions.safeguard.')
		.setCharPref('whitelist', '');
}

function uninstall(data, reason) {
}
