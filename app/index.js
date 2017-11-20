(function () {
'use strict';

class Utils {
  fetch(url, params, CORSFlag = false) {
    if (CORSFlag) {
      return this.doCORSRequest(url, params.method, params.body, params.addRequestHeaders, params.onprogress);
    } else {
      return fetch(url, params);
    }
  }

  doCORSRequest(url, method = 'GET', body, addRequestHeaders, onprogress) {
    return new Promise((resolve, reject) => {
      // Use an XHR rather than fetch so we can have progress events
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      addRequestHeaders && addRequestHeaders(xhr);
      // show progress only while getting data
      if (method === 'GET') {
        xhr.onprogress = onprogress;
      }
      xhr.onload = () => {
        resolve(xhr);
      };
      xhr.onerror = error => {
        reject(error, xhr);
      };
      xhr.send(body);
    });
  }

  dispatchEvent(eventName, dispatcher, eventData = {}) {
    const event = new CustomEvent(eventName, { detail: eventData });
    dispatcher.dispatchEvent(event);
  }
}

class BaseTimelineLoader {
  constructor(url, devToolsConfig) {
    this.utils = new Utils();
    this.url = url;
    this.devToolsConfig = devToolsConfig;
    this.scope = this.devToolsConfig.scope;
  }

  fetchTimelineAsset(addRequestHeaders = Function.prototype, method = 'GET', body) {
    const utils = new Utils();
    const url = this.url.href;
    this.loadingStarted = false;

    return utils.fetch(url, {
      url, addRequestHeaders: addRequestHeaders.bind(this), method, body,
      onprogress: this.updateProgress.bind(this),
    }, true)
      .then(xhr => xhr.responseText)
      .catch(error => {
        console.log(error);
      });
  }

  updateProgress(evt) {
    try {
      this.scope.UI.inspectorView.showPanel('timeline').then(() => {
        const panel = this.scope.Timeline.TimelinePanel.instance();
        // start progress
        if (!this.loadingStarted) {
          this.loadingStarted = true;
          panel && panel.loadingStarted();
        }

        // update progress
        panel && panel.loadingProgress(evt.loaded / (evt.total || this.totalSize));
      });
    } catch (e) {
      console.log(e);
    }
  }
}

class GithubTimelineLoader extends BaseTimelineLoader {
  constructor(...args) {
    super(...args);
    this.url.hostname = this.url.hostname.replace('github.com', 'githubusercontent.com');
  }
}

class DropBoxTimelineLoader extends BaseTimelineLoader {
  constructor(...args) {
    super(...args);
    this.url.hostname = this.url.hostname.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  }
}

class GDriveTimelineLoader extends BaseTimelineLoader {
  constructor(...args) {
    super(...args);
    this.userAccessToken = this.devToolsConfig.userAccessToken;

    try {
      if (this.url.protocol === 'drive:') {
        this.timelineId = this.url.pathname.replace(/^\/+/, '');
      }
      if (this.url.hostname === 'drive.google.com') {
        this.timelineId = this.url.pathname.match(/\b[0-9a-zA-Z]{5,40}\b/)[0];
      }
    } catch (e) {
      // legacy URLs, without a drive:// prefix.
      this.timelineId = this.url;
    }
  }

  fetchTimelineAsset() {
    return this.requestDriveFileMeta().then(response => {
      document.title = `${response.originalFilename} | ${document.title}`;
      const error = response.error;

      if (error) {
        const reasons = error.errors.map(e => e.reason);
        let fileUnavailableStr = '';
        fileUnavailableStr += reasons.includes('notFound') ? 'Confirm you have Edit permissions to the file. ' : '';
        if (reasons.includes('authError')) {
          fileUnavailableStr += 'Please sign in. ';
        }
        console.log(`${fileUnavailableStr} Drive API error: ${error.message}. (${reasons.join(', ')})`);
        throw new Error(response.message, response.error);
      }

      if (!response.downloadUrl) {
        throw new Error(response.message, response.error);
      }

      // alt=media forces file contents in response body.
      this.url = new URL(`${response.downloadUrl}&alt=media`);

      return BaseTimelineLoader.prototype.fetchTimelineAsset.apply(this, [this.setAuthHeaders.bind(this)]);
    });
  }

  setAuthHeaders(xhr) {
    xhr.setRequestHeader('Authorization', `Bearer ${this.userAccessToken}`);
  }

  requestDriveFileMeta() {
    // if there's no this.timelineId then let's skip all this drive API stuff.
    if (!this.timelineId) return;

    const url = new URL(`https://www.googleapis.com/drive/v2/files/${this.timelineId}`);
    url.searchParams.append('fields', 'version, downloadUrl, copyable, title, originalFilename, fileSize');

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${this.userAccessToken}`);

    return this.utils.fetch(url.toString(), {headers})
      .then(resp => resp.json());
  }
}

class AssetLoader {
  constructor(devToolsConfig = {}) {
    this.devToolsConfig = devToolsConfig;
  }

  loadAsset(url) {
    if (url.protocol === 'drive:' || url.hostname === 'drive.google.com') {
      const gDriveTimelineLoader = new GDriveTimelineLoader(url, this.devToolsConfig);
      return gDriveTimelineLoader.fetchTimelineAsset();
    } else if (url.hostname.match('github.com')) {
      const githubTimelineLoader = new GithubTimelineLoader(url, this.devToolsConfig);
      return githubTimelineLoader.fetchTimelineAsset();
    } else if (url.hostname.match('www.dropbox.com')) {
      const dropboxTimelineLoader = new DropBoxTimelineLoader(url, this.devToolsConfig);
      return dropboxTimelineLoader.fetchTimelineAsset();
    } else {
      return Promise.reject();
    }
  }
}

class DevToolsMonkeyPatcher {
  constructor(devToolsConfig = {}) {
    this.devToolsConfig = devToolsConfig;
    this.scope = this.devToolsConfig.scope;
    this.utils = new Utils();
    this.devtoolsBase = this.scope.document.getElementById('devtoolsscript').src.replace(/inspector\.js.*/, '');
    this.timelineLoader = new AssetLoader(this.devToolsConfig);
  }

  patchDevTools() {
    this.monkeyPatchInspectorBackend();
    this.monkeyPatchRuntime();
    this.monkeyPatchCommon();
    this.attachMonkeyPatchListeners();
    this.monkeypatchLoadResourcePromise();
  }

  monkeyPatchInspectorBackend() {
    const AgentPrototype = this.scope.Protocol.InspectorBackend._AgentPrototype;
    AgentPrototype.prototype._sendMessageToBackendPromise = () => Promise.resolve();
  }

  monkeyPatchRuntime() {
    this.scope.Runtime.experiments._supportEnabled = true;
    this.scope.Runtime.experiments.isEnabled = name => {
      return name == 'timelineV8RuntimeCallStats';
    };
  }

  monkeyPatchCommon() {
    this.scope.Common.moduleSetting = function(module) {
      const ret = {
        addChangeListener: () => { },
        removeChangeListener: () => { },
        get: () => new Map(),
        set: () => { },
        getAsArray: () => []
      };
      if (module === 'releaseNoteVersionSeen')
        ret.get = () => Infinity;
      if (module === 'showNativeFunctionsInJSProfile')
        ret.get = () => true;
      return ret;
    };

    // don't send application errors to console drawer
    this.scope.Common.Console.prototype.addMessage = (text, level, show) => {
      level = level || this.scope.Common.Console.MessageLevel.Info;
      const message = new this.scope.Common.Console.Message(text, level, Date.now(), show || false);
      this._messages.push(message);
      this.dispatchEventToListeners(this.scope.Common.Console.Events.MessageAdded, message);
      this.scope.console[level](text);
    };

    // Common.settings is created in a window onload listener
    window.addEventListener('load', () => {
      this.scope.Common.settings.createSetting('timelineCaptureNetwork', true).set(true);
      this.scope.Common.settings.createSetting('timelineCaptureFilmStrip', true).set(true);
    });
  }

  attachMonkeyPatchListeners() {
    // don't let devtools trap ctrl-r
    this.scope.document.addEventListener('keydown', event => {
      if (self.UI && this.scope.UI.KeyboardShortcut.eventHasCtrlOrMeta(event) &&
        String.fromCharCode(event.which).toLowerCase() === 'r') {
        event.handled = true;
      }
    });
  }

  monkeypatchLoadResourcePromise() {
    this.origLoadResourcePromise = this.scope.Runtime.loadResourcePromise;
    this.scope.Runtime.loadResourcePromise = this.loadResource.bind(this);
  }

  loadResource(requestedURL) {
    return this.loadResourcePromise(requestedURL);
  }

  // monkeypatched method for devtools
  loadResourcePromise(requestedURL) {
    const url = new URL(requestedURL);
    const URLofViewer = new URL(location.href);

    // hosted devtools gets confused
    // if DevTools is requesting a file thats on our origin, we'll redirect it to devtoolsBase
    if (url && url.origin === URLofViewer.origin) {
      const relativeurl = url.pathname.replace(URLofViewer.pathname, '').replace(/^\//, '');
      const redirectedURL = new URL(relativeurl, this.devtoolsBase);
      return this.origLoadResourcePromise(redirectedURL.toString());
    }

    return this.timelineLoader.loadAsset(url).then(response => {
      this.utils.dispatchEvent('DevToolsTimelineLoadedInFrame', this.scope.document, { Timeline: this.scope.Timeline });
      return response;
    });
  }
}

class Config {
  constructor() {
    this._scope = null;
    this._userAccessToken = null;
  }

  set scope(val) {
    this._scope = val;
  }

  get scope() {
    if (!this._scope) throw new Error('set "scope" first');
    return this._scope;
  }

  set userAccessToken(value) {
    this._userAccessToken = value;
  }

  get userAccessToken() {
    if (!this._userAccessToken) throw new Error('set userAccessToken first');
    return this._userAccessToken;
  }
}

class DevTools {
  constructor(options = {}) {
    this.devToolsConfig = new Config();
    this.devToolsConfig.scope = options.scope || window;
    this.devToolsConfig.userAccessToken = options.userAccessToken;
    this.scope = this.devToolsConfig.scope;
    this.utils = new Utils();

    const devToolsMonkeyPatcher = new DevToolsMonkeyPatcher(this.devToolsConfig);
    devToolsMonkeyPatcher.patchDevTools();

    this.showTimelinePanel();
    this.observeIdle();
  }

  updateConfig(options = {}) {
    this.devToolsConfig.scope = options.scope || this.devToolsConfig.scope;
    this.devToolsConfig.userAccessToken = options.userAccessToken || this.devToolsConfig.userAccessToken;
  }

  loadTimelineDataFromUrl(timelineURL) {
    const plzRepeat = () => setTimeout(() => this.loadTimelineDataFromUrl(timelineURL), 100);
    if (typeof this.scope.Timeline === 'undefined' ||
      typeof this.scope.Timeline.TimelinePanel === 'undefined'
    ) return plzRepeat();

    this.scope.Timeline.TimelinePanel.instance()._loadFromURL(timelineURL);
  }

  observeIdle() {
    const plzRepeat = () => setTimeout(() => this.observeIdle(), 100);
    if (typeof this.scope.Timeline === 'undefined' ||
      typeof this.scope.Timeline.TimelinePanel === 'undefined' ||
      typeof this.scope.Timeline.TimelinePanel.State === 'undefined' ||
      this.scope.Timeline.TimelinePanel.instance()._state !== this.scope.Timeline.TimelinePanel.State.Idle
    ) return plzRepeat();

    this.utils.dispatchEvent('DevToolsReadyInFrame', this.scope.document, { Timeline: this.scope.Timeline });
  }

  showTimelinePanel() {
    const plzRepeat = () => setTimeout(() => this.showTimelinePanel(), 100);
    if (typeof this.scope.UI === 'undefined' ||
      typeof this.scope.UI.inspectorView === 'undefined'
    ) return plzRepeat();
    this.scope.UI.inspectorView.showPanel('timeline');
  }
}

customElements.define('dev-tools-element', class extends HTMLElement {
  constructor() {
    super();
    this._iframe = document.createElement('iframe');
    this._contentWindow = null;
    this._iframe.onload = () => {
      this._contentWindow = this._iframe.contentWindow;
      // pass global params to iframe
      this._contentWindow.IframeDevTools = class IframeDevTools extends DevTools {};
      this._contentWindow.timelineURL = this.getAttribute('src');
      this._contentWindow.userAccessToken = this.getAttribute('user-access-token');
      this._contentWindow.document.write(`
        <body>
          <script src="https://chrome-devtools-frontend.appspot.com/serve_file/@14fe0c24836876e87295c3bd65f8482cffd3de73/inspector.js?${Math.random()}" id="devtoolsscript"></script>
          <script src="https://apis.google.com/js/client.js"></script>
          <script>
              document.addEventListener('DOMContentLoaded', () => {
                window.devtools = new window.IframeDevTools({ scope: window, userAccessToken: window.userAccessToken });
                if (window.timelineURL) {
                  window.devtools.loadTimelineDataFromUrl(window.timelineURL);
                }
              });
              const DOMContentLoadedEvent = document.createEvent('Event');
              DOMContentLoadedEvent.initEvent('DOMContentLoaded', true, true);
              window.document.dispatchEvent(DOMContentLoadedEvent);
          </script>
        </body>
      `);

      this._contentWindow.document.addEventListener('DevToolsReadyInFrame', this.handleDevToolsReadyInFrame.bind(this));
      this._contentWindow.document.addEventListener('DevToolsTimelineLoadedInFrame', this.handleDevToolsTimelineLoadedInFrame.bind(this));
    };
  }

  static get observedAttributes() {
    const attrs = Object.keys(HTMLIFrameElement.prototype);
    attrs.push('user-access-token');
    return attrs;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._contentWindow && this._contentWindow.devtools) {
      switch (name) {
        case 'user-access-token':
          this._contentWindow.devtools.updateConfig({ userAccessToken: newValue });
          break;
        case 'src':
          this._contentWindow.devtools.loadTimelineDataFromUrl(newValue);
          break;
      }
      return;
    }

    if (name === 'src') return;

    this._iframe.setAttribute(name, newValue);
  }

  connectedCallback() {
    if (!this.closest(':root')) return;
    this.append(this._iframe);
  }

  handleDevToolsReadyInFrame(event) {
    this.dispatchEvent(new CustomEvent('DevToolsReady', { detail: event.detail }));
  }

  handleDevToolsTimelineLoadedInFrame(event) {
    this.dispatchEvent(new CustomEvent('DevToolsTimelineLoaded', { detail: event.detail }));
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const searchParams = new URL(location.href).searchParams;
  const timelineURL = searchParams.get('loadTimelineFromURL');

  if (timelineURL) {
    const devToolsElement = document.createElement('dev-tools-element');
    devToolsElement.setAttribute('src', timelineURL);

    const devToolsContainer = document.querySelector('.dev-tools-container');
    devToolsContainer.appendChild(devToolsElement);

    const welcomeContainer = document.querySelector('.welcome');
    welcomeContainer.classList.add('hide');
  }
});

}());
