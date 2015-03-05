/* exported startup, shutdown, install, uninstall */

'use strict';

function import_(uri) {
	const scope = {};
	Components.utils.import(uri, scope);
	return scope;
}

const { Services } = import_('resource://gre/modules/Services.jsm');
const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

const preferences = Services.prefs.getBranch('extensions.safeguard.');
const preferencesDefault = Services.prefs.getDefaultBranch('extensions.safeguard.');

const recentHosts = [];

function addRecentHost(host) {
	if (recentHosts.indexOf(host) === -1) {
		recentHosts.unshift(host);

		if (recentHosts.length > 20) {
			recentHosts.pop();
		}
	}
}

function empty(node) {
	let child;

	while ((child = node.firstChild)) {
		node.removeChild(child);
	}
}

function preferenceSet(name) {
	let set = new Set();
	let modifying = false;

	function load() {
		if (!modifying) {
			set = new Set(preferences.getCharPref(name).match(/\S+/));
		}
	}

	function save() {
		modifying = true;
		preferences.setCharPref(name, Array.from(set).join(' '));
		modifying = false;
	}

	return {
		add: function add(item) {
			set.add(item);
			save();
		},
		delete: function delete_(item) {
			set.delete(item);
			save();
		},
		has: function has(item) {
			return set.has(item);
		},
		load: load,
		startup: function startup() {
			preferencesDefault.setCharPref(name, '');
			preferences.addObserver(name, load, false);
			load();
		},
		shutdown: function shutdown() {
			preferences.removeObserver(name, load);
		}
	};
}

const allow = preferenceSet('allow');
const redirect = preferenceSet('redirect');

function addButton(window) {
	if (!window.CustomizableUI) {
		return;
	}

	const document = window.document;

	const panelView = document.createElementNS(XUL_NS, 'panelview');
	panelView.setAttribute('id', 'safeguard-manage');
	panelView.setAttribute('flex', '1');
	panelView.classList.add('PanelUI-subView');

	const panelHeader = document.createElementNS(XUL_NS, 'label');
	panelHeader.classList.add('panel-subview-header');
	panelHeader.setAttribute('value', 'Manage whitelist');

	const panelContent = document.createElementNS(XUL_NS, 'vbox');
	panelContent.classList.add('panel-subview-body');

	const panelParent = document.getElementById('PanelUI-multiView');

	panelView.appendChild(panelHeader);
	panelView.appendChild(panelContent);
	panelParent.appendChild(panelView);

	function updateActions() {
		function addToggle(host) {
			const group = document.createElementNS(XUL_NS, 'radiogroup');
			group.setAttribute('orient', 'horizontal');

			const radioBlock = document.createElementNS(XUL_NS, 'radio');
			radioBlock.setAttribute('label', 'block');
			radioBlock.value = 'block';

			const radioRedirect = document.createElementNS(XUL_NS, 'radio');
			radioRedirect.setAttribute('label', 'redirect');
			radioRedirect.value = 'redirect';

			const radioAllow = document.createElementNS(XUL_NS, 'radio');
			radioAllow.setAttribute('label', 'allow');
			radioAllow.value = 'allow';

			if (allow.has(host)) {
				radioAllow.setAttribute('selected', 'true');
			} else if (redirect.has(host)) {
				radioRedirect.setAttribute('selected', 'true');
			} else {
				radioBlock.setAttribute('selected', 'true');
			}

			radioBlock.addEventListener('command', function () {
				if (radioBlock.selected) {
					allow.delete(host);
					redirect.delete(host);
				}
			}, false);

			radioRedirect.addEventListener('command', function () {
				if (radioRedirect.selected) {
					allow.delete(host);
					redirect.add(host);
				}
			}, false);

			radioAllow.addEventListener('command', function () {
				if (radioAllow.selected) {
					allow.add(host);
					redirect.delete(host);
				}
			}, false);

			// ick
			const padding = document.createElementNS(XUL_NS, 'box');
			padding.setAttribute('width', '5px');

			group.appendChild(padding);
			group.appendChild(document.createTextNode(host));
			group.appendChild(radioBlock);
			group.appendChild(radioRedirect);
			group.appendChild(radioAllow);
			panelContent.appendChild(group);
		}

		empty(panelContent);
		recentHosts.forEach(addToggle);
	}

	window.CustomizableUI.createWidget({
		id: 'safeguard-button',
		type: 'view',
		viewId: 'safeguard-manage',
		tooltiptext: 'Manage HTTP blocking',
		label: 'Safeguard',
		onViewShowing: updateActions,
	});
}

function removeButton(window) {
	window.CustomizableUI.destroyWidget('safeguard-button');
	window.document.getElementById('safeguard-manage').remove();
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
			const uri = request.URI;
			const host = uri.host;

			if (uri.schemeIs('http')) {
				if (redirect.has(host)) {
					uri.scheme = 'https';
					request.redirectTo(uri);
				} else if (!allow.has(host)) {
					request.cancel(Components.results.NS_ERROR_ABORT);
				}

				addRecentHost(host);
			} else if (uri.schemeIs('https') && (allow.has(host) || redirect.has(host))) {
				addRecentHost(host);
			}
		}
	}
};

function startup() {
	allow.startup();
	redirect.startup();

	Services.obs.addObserver(requestObserver, 'http-on-modify-request', false);

	Services.ww.registerNotification(windowObserver);
	eachWindow(addButton);
}

function shutdown() {
	Services.obs.removeObserver(requestObserver, 'http-on-modify-request');

	allow.shutdown();
	redirect.shutdown();

	Services.ww.unregisterNotification(windowObserver);
	eachWindow(removeButton);
}

function install() {
}

function uninstall() {
}
