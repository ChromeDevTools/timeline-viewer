
class Viewer {

  constructor() {
    this.params = new URL(location.href).searchParams;
    this.timelineURL = this.params.get('loadTimelineFromURL');
    this.timelineId;
    this.timelineProvider = 'url';

    this.totalSize = 50 * 1000 * 1000;
    this.loadingStarted = false;

    // remote location of devtools we're using
    this.devtoolsBase = document.getElementById('devtoolsscript').src.replace(/inspector\.js.*/, '');

    this.statusElem = document.getElementById('status');
    this.authBtn = document.getElementById('auth');
    this.docsElem = document.getElementById('howto');

    this.authBtn.addEventListener('click', this.checkAuth.bind(this));

    this.driveAssetLoaded = new Promise((resolve, reject) => {
      this.driveAssetLoadedResolver = resolve;
    });

    this.parseURLforTimelineId(this.timelineURL);
    if (!this.timelineURL || this.startSplitViewIfNeeded(this.timelineURL)) {
      this.docsElem.hidden = false;
      return;
    }

    // Start loading DevTools. (checkAuth will be racing against it)
    this.statusElem.hidden = false;

    this.initializeDevTools();
    this.makeDevToolsVisible(true);
  }

  parseURLforTimelineId(url) {
    try {
      const parsedURL = new URL(url);
      if (parsedURL.protocol === 'drive:') {
        this.timelineProvider = 'drive';
        this.timelineId = parsedURL.pathname.replace(/^\/+/, '');
      }
    } catch (e) {
       // legacy URLs, without a drive:// prefix.
      this.timelineId = url;
      this.timelineProvider = 'drive';
    }
  }

  initializeDevTools() {
    Runtime.experiments._supportEnabled = true;
    Runtime.experiments.isEnabled = name => {
      return name == 'timelineV8RuntimeCallStats'
    }

    Common.moduleSetting = function (module) {
      if (module === 'showNativeFunctionsInJSProfile') return { get: _ => true };
      return {
        addChangeListener: _ => { },
        removeChangeListener: _ => { },
        get: _ => new Map(),
        set: _ => { },
        getAsArray: _ => []
      };
    };

    // nerf some oddness
    Bindings.DeferredTempFile = function() {};
    Bindings.DeferredTempFile.prototype = {
      write: _ => { },
      remove: _ => { },
      finishWriting: _ => { }
    };

    // Common.settings is created in a window onload listener
    window.addEventListener('load', _ => {
      Common.settings.createSetting('timelineCaptureNetwork', true).set(true)
      Common.settings.createSetting('timelineCaptureFilmStrip', true).set(true)
    });
  }

  startSplitViewIfNeeded(urls) {
    urls = urls.split(',');

    if (urls.length > 1) {
      var frameset = document.createElement('frameset');
      frameset.setAttribute('rows', Array(urls.length).fill(`${100/2}%`).join(','));

      urls.forEach(url => {
        var frame = document.createElement('frame');
        frame.setAttribute('src', `./?loadTimelineFromURL=${url.trim()}`);
        frameset.appendChild(frame);
      });
      document.body.appendChild(frameset);
      document.documentElement.classList.add('fullbleed');
      document.querySelector('.welcome').remove();
      return true;
    }
    return false;
  }

  makeDevToolsVisible(bool) {
    document.documentElement.classList[bool ? 'remove' : 'add']('hide-devtools');
  }

  updateStatus(str) {
    this.statusElem.textContent = str;
  }

  signOut() {
    try {
      gapi.auth2.getAuthInstance().signOut()
    } catch(e){}
  }

  checkAuth(opts) {
    const handleAuth = this.handleAuthResult.bind(this);
    const oAuthOptions = {
      fetch_basic_profile: false,
      client_id: config.clientId,
      scope: config.scopes.join(' ')
    };

    gapi.load('client:auth2', function() {
      gapi.client.setApiKey(config.apiKey);

      // if we have no authinstance yet, initialize
      if (!gapi.auth2.getAuthInstance())
        return gapi.auth2.init(oAuthOptions).then(handleAuth);

      // handle the click
      gapi.auth2.getAuthInstance().signIn(oAuthOptions).then(handleAuth)
    }.bind(this));

    return false;
  }

  handleAuthResult() {
    if (this.timelineProvider !== 'drive') return;

    if (gapi.auth2.getAuthInstance().isSignedIn.get() === false) {
      this.updateStatus(`Drive API status: not signed in`);

      this.authBtn.hidden = false;
      this.docsElem.hidden = false;
      this.makeDevToolsVisible(false);
      return new Error(`Google auth error`);
    }

    this.authBtn.hidden = true;
    this.updateStatus('Drive API status: successfully signed in');
    this.statusElem.hidden = false;
    this.requestDriveFileMeta();
  }

  monkeypatchLoadResourcePromise() {
      this._orig_loadResourcePromise = Runtime.loadResourcePromise;
      Runtime.loadResourcePromise = viewer.loadResourcePromise.bind(viewer);
  }

  loadResourcePromise(url) {
    var URLtoLoad = new URL(url);
    var URLofViewer = new URL(location.href);
    var URLdevtoolsBase = new URL(this.devtoolsBase);

    // hosted devtools gets confused
    // if DevTools is requesting a file thats on our origin, we'll redirect it to devtoolsBase
    if (URLtoLoad && URLtoLoad.origin === URLofViewer.origin) {
      var relativeURLtoLoad = URLtoLoad.pathname.replace(URLofViewer.pathname, '').replace(/^\//,'');
      var redirectedURL = new URL(relativeURLtoLoad, this.devtoolsBase)
      return this._orig_loadResourcePromise(redirectedURL.toString());
    }

    if (this.timelineProvider === 'drive')
      return this.driveAssetLoaded.then(payload => payload);

    // pass through URLs that aren't our timelineURL param
    if (url !== this.timelineURL) {
      return this._orig_loadResourcePromise(url);
    }

    // adjustments for CORS
    URLtoLoad.hostname = URLtoLoad.hostname.replace('github.com', 'githubusercontent.com');
    URLtoLoad.hostname = URLtoLoad.hostname.replace('www.dropbox.com', 'dl.dropboxusercontent.com');

    return this.doCORSrequest(URLtoLoad.toString()).then(payload => payload);
  }

  requestDriveFileMeta() {
    // if there's no this.timelineId then let's skip all this drive API stuff.
    if (!this.timelineId) return;

    var url = new URL(`https://www.googleapis.com/drive/v2/files/${this.timelineId}`);
    url.searchParams.append('fields', 'version, downloadUrl, copyable, title, originalFilename, fileSize')
    url.searchParams.append('key', config.apiKey);

    var headers = new Headers();
    var user = gapi.auth2.getAuthInstance().currentUser.get();
    var accessToken = user.getAuthResponse().access_token;
    headers.append('Authorization', 'Bearer ' + accessToken);

    fetch(url.toString(), {headers: headers})
      .then(resp => resp.json())
      .then(this.handleDriveFileMetadata.bind(this));
  }

  handleDriveFileMetadata(response) {
    document.title = `${response.originalFilename} | ${document.title}`;
    this.totalSize = +response.fileSize;
    const error = response.error;

    if (error) {
      this.makeDevToolsVisible(false);
      const reasons = error.errors.map(e => e.reason);
      let fileUnavailableStr = '';
      letUnavailableStr += reasons.includes('notFound') ? 'Confirm you have Edit permissions to the file. ' : '';
      if (reasons.includes('authError')) {
        letUnavailableStr += 'Please sign in. ';
        this.authBtn.hidden = false;
      }
      this.updateStatus(`${fileUnavailableStr} Drive API error: ${error.message}. (${reasons.join(', ')})`);
      throw new Error(response.message, response.error);
    }

    if (!response.downloadUrl) {
      this.makeDevToolsVisible(false);
      this.updateStatus('Downloading not available. Confirm you have Edit permissions to the file.');
      throw new Error(response.message, response.error);
    }

    this.makeDevToolsVisible(true);
    this.updateStatus('Starting download of timeline from Drive. Please wait...');
    // alt=media forces file contents in response body.
    var url = response.downloadUrl + '&alt=media';

    this.fetchDriveAsset(url)
      .then(payload => this.handleDriveAsset(payload))
      .catch(err => {
        this.makeDevToolsVisible(false);
        this.updateStatus('Download of Drive asset failed.');
        throw new Error('XHR of Drive asset failed');
      });
  }

  fetchDriveAsset(url, callback) {
    return this.doCORSrequest(url, function(xhr) {
      var user = gapi.auth2.getAuthInstance().currentUser.get();
      var accessToken = user.getAuthResponse().access_token;
      xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    });
  }

  handleDriveAsset(payload) {
    const msg = `✅ Timeline downloaded from Drive. (${payload.length} bytes)`;
    this.updateStatus(msg);
    console.log(msg);
    return this.driveAssetLoadedResolver(payload);
  }

  doCORSrequest(url, callbetween) {
    return new Promise((resolve, reject) => {
      // Use an XHR rather than fetch so we can have progress events
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      callbetween && callbetween(xhr);
      xhr.onprogress = this.updateProgress.bind(this);
      xhr.onload = _ => resolve(xhr.responseText);
      xhr.onerror = (err => {
        this.makeDevToolsVisible(false);
        this.updateStatus('Download of asset failed. ' + ((xhr.readyState == xhr.DONE) ? 'CORS headers likely not applied.' : ''));
        reject(err);
      }).bind(this);
      xhr.send();
    });
  }

  updateProgress(evt) {
    try {
      this.updateStatus(`Download progress: ${((evt.loaded / this.totalSize) * 100).toFixed(2)}%`);

      UI.inspectorView.showPanel('timeline').then(_ => {
        const panel = Timeline.TimelinePanel.instance();
        // start progress
        if (!this.loadingStarted) {
          this.loadingStarted = true;
          panel && panel.loadingStarted();
        }
        // update progress
        panel && panel.loadingProgress(evt.loaded / (evt.total || this.totalSize));

        // flip off filmstrip or network if theres no data in the trace
        if (!this.netReqMuted) {
          this.netReqMuted = true;
          var oldSetMarkers = panel._setMarkers;
          panel._setMarkers = function () {
            if (panel._model.networkRequests().length === 0)
              Common.settings.createSetting('timelineCaptureNetwork', true).set(false)
            if (panel._filmStripModel._frames.length === 0)
              Common.settings.createSetting('timelineCaptureFilmStrip', true).set(false)
            oldSetMarkers.call(panel);
          }
        }
      });
    } catch (e) {}
  }
}



const form = document.querySelector('form');
form.addEventListener('submit', evt => {
    evt.preventDefault();
    const formdata = new FormData(evt.target)
    const url = formdata.get('url');
    if (!url) return;

    const parsedURL = new URL(location.href);
    parsedURL.searchParams.delete('loadTimelineFromURL')
    // this is weird because we don't want url encoding of the URL
    parsedURL.searchParams.append('loadTimelineFromURL', 'REPLACEME')
    const newurl = parsedURL.toString().replace('REPLACEME', url);
    location.href = newurl;
});

[...document.querySelectorAll('a[data-url]')].forEach(elem => {
    elem.addEventListener('click', evt => {
        evt.preventDefault();
        evt.cancelBubble = true;
        var url = evt.target.dataset.url;
        var input = document.querySelector('#enterurl');
        input.value = url;
    });
});

// don't let devtools trap ctrl-r
document.addEventListener('keydown', event => {
  if (self.UI && UI.KeyboardShortcut.eventHasCtrlOrMeta(event) && String.fromCharCode(event.which).toLowerCase() === 'r') {
      event.handled = true;
    }
});
