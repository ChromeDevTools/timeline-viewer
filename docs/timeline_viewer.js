// single monolithic class, begging to be broken apart into modules...

'use strict';
/* global SyncView, GoogleAuth, Utils, DevTools */

class Viewer {

  constructor() {
    this.params = new URL(location.href).searchParams;
    this.syncView = new SyncView();
    this.timelineURL = this.params.get('loadTimelineFromURL');
    this.timelineId;
    this.timelineProvider = 'url';

    this.totalSize = 50 * 1000 * 1000;
    this.loadingStarted = false;
    this.refreshPage = false;
    this.canUploadToDrive = false;
    this.welcomeView = false;
    // remote location of devtools we're using
    this.devtoolsBase = document.getElementById('devtoolsscript').src.replace(/inspector\.js.*/, '');

    this.statusElem = document.getElementById('status');
    this.infoMessageElem = document.getElementById('info-message');
    this.uploadToDriveElem = document.getElementById('upload-to-drive');
    this.networkOnlineStatusElem = document.getElementById('online-status');
    this.networkOfflineStatusElem = document.getElementById('offline-status');
    this.authBtn = document.getElementById('auth');
    this.docsElem = document.getElementById('howto');

    this.authBtn.addEventListener('click', this.checkAuth.bind(this));
    this.uploadToDriveElem.addEventListener('click', this.uploadTimelineData.bind(this));

    this.auth = new GoogleAuth();
    this.utils = new Utils();
    this.devTools = new DevTools({viewerInstance: this});

    this.driveAssetLoaded = new Promise((resolve, reject) => {
      this.driveAssetLoadedResolver = resolve;
    });

    this.parseURLforTimelineId(this.timelineURL);

    if (!this.timelineURL || this.startSplitViewIfNeeded(this.timelineURL)) {
      this.splitViewContainer = document.getElementById('split-view-container');
      this.isSplitView = this.splitViewContainer ? true : false;
      this.canUploadToDrive = true;
      this.welcomeView = true;
      this.handleDragEvents();
      this.docsElem.hidden = false;
    }

    // Start loading DevTools. (checkAuth will be racing against it)
    this.statusElem.hidden = false;

    this.handleNetworkStatus();
    this.devTools.init();

    if (!this.welcomeView) {
      this.makeDevToolsVisible(true);
    }
  }

  handleDragEvents() {
    const dropboxEl = document.getElementById('dropbox');
    if (dropboxEl)
      dropboxEl.addEventListener('dragover', this.dragover.bind(this), false);
  }

  toggleUploadToDriveElem(display) {
    this.uploadToDriveElem.hidden = !display;
  }

  showInfoMessage(text) {
    this.infoMessageElem.textContent = text;
    this.infoMessageElem.hidden = false;

    setTimeout(() => {
      this.hideInfoMessage();
    }, 3000);
  }

  hideInfoMessage() {
    this.infoMessageElem.textContent = '';
    this.infoMessageElem.hidden = true;
  }

  dragover(e) {
    e.stopPropagation();
    e.preventDefault();
    this.makeDevToolsVisible(true);
    // we fair that all timeline resources are uploaded
    UI.inspectorView.showPanel('timeline').then(_ => {
      this.toggleUploadToDriveElem(this.canUploadToDrive);
    });
  }

  handleNetworkStatus() {
    if (navigator.onLine) {
      this.toggleNetworkStatusMessage();
    } else {
      this.toggleNetworkStatusMessage( { status: 'offline' } );
    }

    this.networkOnlineStatusElem.addEventListener('click', function() {
      this.networkOnlineStatusElem.hidden = true;
    }.bind(this));

    this.networkOfflineStatusElem.addEventListener('click', function() {
      this.networkOfflineStatusElem.hidden = true;
    }.bind(this));

    window.addEventListener('online', function() {
      this.toggleNetworkStatusMessage();
    }.bind(this), false);

    window.addEventListener('offline', function() {
      this.toggleNetworkStatusMessage( { status: 'offline' } );
    }.bind(this), false);
  }

  toggleNetworkStatusMessage( options = { status: 'online' } ) {
    if (options.status === 'online') {
      this.networkOnlineStatusElem.hidden = false;
      this.networkOfflineStatusElem.hidden = true;
    } else {
      this.networkOnlineStatusElem.hidden = true;
      this.networkOfflineStatusElem.hidden = false;
    }
  }

  parseURLforTimelineId(url) {
    try {
      const parsedURL = new URL(url);
      if (parsedURL.protocol === 'drive:') {
        this.timelineProvider = 'drive';
        this.timelineId = parsedURL.pathname.replace(/^\/+/, '');
      }
      if (parsedURL.hostname === "drive.google.com") {
        this.timelineProvider = 'drive';
        this.timelineId = parsedURL.pathname.match(/\b[0-9a-zA-Z]{5,40}\b/)[0];
      }
    } catch (e) {
       // legacy URLs, without a drive:// prefix.
      this.timelineId = url;
      this.timelineProvider = 'drive';
    }
  }

  startSplitViewIfNeeded(urls) {
    urls = urls.split(',');

    if (urls.length > 1) {
      const frameset = document.createElement('frameset');
      frameset.setAttribute('id', 'split-view-container');
      frameset.setAttribute('rows', Array(urls.length).fill(`${100/2}%`).join(','));

      urls.forEach((url, index) => {
        const frame = document.createElement('frame');
        frame.setAttribute('id', `split-view-${index}`);
        frame.setAttribute('src', `./?loadTimelineFromURL=${url.trim()}`);
        frameset.appendChild(frame);
      });
      document.body.appendChild(frameset);
      document.documentElement.classList.add('fullbleed');
      document.querySelector('.welcome').remove();
      document.querySelector('.top-message-container').remove();
      return true;
    }
    return false;
  }

  makeDevToolsVisible(bool) {
    this.welcomeView = !bool;
    document.documentElement.classList[bool ? 'remove' : 'add']('hide-devtools');
  }

  updateStatus(str) {
    this.statusElem.textContent = str;
  }

  checkAuth() {
    const handleAuth = this.handleAuthResult.bind(this);
    this.auth.checkAuth(handleAuth);

    return false;
  }

  handleAuthResult() {
    if (this.timelineProvider !== 'drive') return;

    if (this.auth.isSignedIn() === false) {
      this.updateStatus('Drive API status: not signed in');

      this.authBtn.hidden = false;
      this.docsElem.hidden = false;
      this.canUploadToDrive = false;
      this.makeDevToolsVisible(false);
      return new Error('Google auth error');
    }

    this.authBtn.hidden = true;
    this.updateStatus('Drive API status: successfully signed in');
    this.statusElem.hidden = false;
    this.canUploadToDrive = true;
    this.requestDriveFileMeta();
  }

  loadResource(requestedURL) {
    return this.loadResourcePromise(requestedURL)
      .then(resp => {
        this.devTools.monkeyPatchingHandleDrop();
        return resp;
      });
  }

  // monkeypatched method for devtools
  loadResourcePromise(requestedURL) {
    var url = new URL(requestedURL);
    var URLofViewer = new URL(location.href);
    var URLdevtoolsBase = new URL(this.devtoolsBase);

    // hosted devtools gets confused
    // if DevTools is requesting a file thats on our origin, we'll redirect it to devtoolsBase
    if (url && url.origin === URLofViewer.origin) {
      var relativeurl = url.pathname.replace(URLofViewer.pathname, '').replace(/^\//,'');
      var redirectedURL = new URL(relativeurl, this.devtoolsBase)
      return this._orig_loadResourcePromise(redirectedURL.toString());
    }

    if (this.timelineProvider === 'drive')
      return this.driveAssetLoaded.then(payload => payload);

    // pass through URLs that aren't our timelineURL param
    if (requestedURL !== this.timelineURL) {
      return this._orig_loadResourcePromise(url);
    }

    // adjustments for CORS
    url.hostname = url.hostname.replace('github.com', 'githubusercontent.com');
    url.hostname = url.hostname.replace('www.dropbox.com', 'dl.dropboxusercontent.com');

    return this.fetchTimelineAsset(url.href).then(payload => payload);
  }

  requestDriveFileMeta() {
    // if there's no this.timelineId then let's skip all this drive API stuff.
    if (!this.timelineId) return;

    const url = new URL(`https://www.googleapis.com/drive/v2/files/${this.timelineId}`);
    url.searchParams.append('fields', 'version, downloadUrl, copyable, title, originalFilename, fileSize');
    url.searchParams.append('key', config.apiKey);

    const headers = new Headers();
    const user = this.auth.getAuthInstance().currentUser.get();
    const accessToken = user.getAuthResponse().access_token;
    headers.append('Authorization', 'Bearer ' + accessToken);

    this.utils.fetch(url.toString(), {headers: headers})
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
      fileUnavailableStr += reasons.includes('notFound') ? 'Confirm you have Edit permissions to the file. ' : '';
      if (reasons.includes('authError')) {
        fileUnavailableStr += 'Please sign in. ';
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
    return this.fetchTimelineAsset(url, this.setAuthHeaders.bind(this));
  }

  handleDriveAsset(payload) {
    const msg = `✅ Timeline downloaded from Drive. (${payload.length} bytes)`;
    this.updateStatus(msg);
    this.showInfoMessage(msg);
    return this.driveAssetLoadedResolver(payload);
  }

  fetchTimelineAsset(url, addRequestHeaders = Function.prototype, method = 'GET', body) {
    this.netReqMuted = false;
    this.loadingStarted = false;
    return this.utils.fetch(url, {
      url, addRequestHeaders: addRequestHeaders.bind(this), method, body,
      onprogress: this.updateProgress.bind(this),
    }, true)
      .then(xhr => {
        if (this.isSplitView) {
          return this.syncView.splitViewTimelineLoaded()
            .then(_ => SyncView.synchronizeRange(SyncView.panels()[0], this.syncView))
            .then(_ => xhr.responseText);
        } else {
          return xhr.responseText;
        }
      })
      .catch((error, xhr) => {
        this.makeDevToolsVisible(false);
        this.updateStatus('Download of asset failed. ' + ((xhr.readyState == xhr.DONE) ? 'CORS headers likely not applied.' : ''));
      });
  }

  setAuthHeaders(xhr) {
    const user = this.auth.getAuthInstance().currentUser.get();
    const accessToken = user.getAuthResponse().access_token;
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
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
          const oldSetMarkers = panel._setMarkers;
          panel._setMarkers = function () {
            if (this._performanceModel._timelineModel.networkRequests().length === 0)
              Common.settings.createSetting('timelineCaptureNetwork', true).set(false);
            if (this._performanceModel.filmStripModel()._frames.length === 0)
              Common.settings.createSetting('timelineCaptureFilmStrip', true).set(false);
            oldSetMarkers.call(this, this._performanceModel._timelineModel);
          }
        }
      });
    } catch (e) {}
  }

  uploadTimelineData() {
    Timeline.TimelinePanel.instance()._backingStorage._file.read(event => {
      this.uploadData(event.target.result);
    });
  }

  uploadData(traceData) {
    this.toggleUploadToDriveElem(false);
    this.showInfoMessage('Uploading trace on Google Drive ...');

    const contentType = 'application/octet-stream';

    const fileMetadata = {
      title: `TimelineData-${Date.now()}.json`,
      mimeType: contentType,
      writersCanShare: true,
      uploadType: 'multipart'
    };
    const media = {
      mimeType: contentType,
      body: traceData
    };

    const boundary = Math.random().toString().substr(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    // much prettier then template literals because of mess with LF
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: ' + contentType + '\r\n\r\n' +
      media.body +
      close_delim;

    // todo use fetch instead of xhr. it's broken now...
    this.doCORSrequest('https://www.googleapis.com/upload/drive/v2/files', xhr => {
      this.setAuthHeaders(xhr);
      xhr.setRequestHeader('Content-type', 'multipart/mixed; charset=utf-8; boundary=' + boundary);
    }, 'POST', multipartRequestBody)
      .then(response => JSON.parse(response))
      .then(data => {
        return this.shareFile(data.id).then(_ => data)
      })
      .then(data => {
        if (data.error) return;
        this.changeUrl(data.id);
        this.showInfoMessage('Trace successfully uploaded on Google Drive');
      })
      .catch(_ => {
        this.toggleUploadToDriveElem(this.canUploadToDrive);
        this.showInfoMessage('Trace was not uploaded on Google Drive :(');
      });
  }

  shareFile(fileId) {
    const url = new URL(`https://www.googleapis.com/drive/v2/files/${fileId}/permissions`);
    const body = {
      role: 'writer',
      type: 'anyone'
    };
    url.searchParams.append('key', config.apiKey);

    const headers = new Headers();
    const user = this.auth.getAuthInstance().currentUser.get();
    const accessToken = user.getAuthResponse().access_token;
    headers.append('Authorization', 'Bearer ' + accessToken);
    headers.append('Content-Type', 'application/json');

    return this.utils.fetch(url.toString(), {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
  }

  changeUrl(id) {
    let url = `?loadTimelineFromURL=drive://${id}`;
    if (this.refreshPage) {
      window.location.href = `/${url}`;
    } else {
      const state = {'file_id': id};
      const title = 'Timeline Viewer';
      history.replaceState(state, title, url);
    }
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
