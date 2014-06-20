'use strict';

Components.utils.import('resource://gre/modules/Services.jsm');

const windowMediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);

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

function* windows(type) {
	const windowEnumerator = windowMediator.getEnumerator(null);

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

			if (request.URI.scheme === 'http') {
				request.URI.scheme = 'https';
				request.redirectTo(request.URI);
			}
		}
	}
};

function startup(data, reason) {
	Services.obs.addObserver(observer, 'http-on-modify-request', false);

	windowMediator.addListener(windowListener);

	for (let domWindow of windows(null)) {
		addButton(domWindow);
	}
}

function shutdown(data, reason) {
	Services.obs.removeObserver(observer, 'http-on-modify-request');

	windowMediator.removeListener(windowListener);

	for (let domWindow of windows(null)) {
		removeButton(domWindow);
	}
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
