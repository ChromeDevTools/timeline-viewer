
class Viewer {

  constructor() {
    this.params = new URL(location.href).searchParams;
    this.timelineURL = this.params.get('loadTimelineFromURL');
    this.timelineId;
    this.timelineProvider = 'url';
    this.totalSize = 50 * 1000 * 1000;
    this.loadingStarted = false;
    this.statusElem = document.getElementById('status');

    try {
      const parsedURL = new URL(this.timelineURL);
      if (parsedURL.protocol === 'drive:') {
        this.timelineProvider = 'drive';
        this.timelineId = parsedURL.pathname.replace(/^\/+/, '');
      }
    } catch (e) {
       // legacy URLs, without a drive:// prefix.
      this.timelineId = this.timelineURL
      this.timelineProvider = 'drive';
    }

    this.authBtn = document.getElementById('auth');
    this.authBtn.addEventListener('click', this.handleAuthClick.bind(this));

    this.driveAPIloaded = new Promise((resolve, reject) => {
      this.driveAPIloadedresolve = resolve;
    });

    this.driveFileLoaded = new Promise((resolve, reject) => {
      // get this request going now.
      this.requestDriveFile(resolve, reject);
    });

    if (!this.timelineURL) {
      document.getElementById('howto').hidden = false;
      return;
    }

    // show loading message..
    this.statusElem.hidden = false;

    // start devtools.
    Runtime.startApplication('inspector');
  }

  checkAuth() {
    gapi.auth.authorize({
      'client_id': config.clientId,
      'scope': config.scopes.join(' '),
      'immediate': true
    }, this.handleAuthResult.bind(this));
  }

  handleAuthClick(event) {
    gapi.auth.authorize({
      client_id: config.clientId,
      scope: config.scopes.join(' '),
      immediate: false
    }, this.handleAuthResult.bind(this));
    return false;
  }

  handleAuthResult(authResult) {
    if (this.timelineProvider !== 'drive') return;

    if (authResult && !authResult.error) {
      this.authBtn.hidden = true;
      this.statusElem.textContent = 'Drive API access: successful';
      this.statusElem.hidden = false;
      gapi.client.load('drive', 'v2', this.driveAPIloadedresolve);
    } else {
      // auth error.
      this.authBtn.hidden = false;
      this.statusElem.textContent = `Drive API access: not authorized (${authResult.error_subtype})`;
      document.getElementById('howto').hidden = false;
      this.hideDevTools();
      return new Error(`Google auth error: ${authResult.error}: ${authResult.error_subtype}`);
    }
  }

  hideDevTools() {
    document.body.classList.add('hide-devtools');
  }

  showDevTools() {
    document.body.classList.remove('hide-devtools');
  }

  loadResourcePromise(url) {
    // pass through URLs that aren't our timelineURL param
    if (url !== this.timelineURL)
      return _loadResourcePromise(...arguments);

    if (this.timelineProvider === 'drive')
      return this.driveFileLoaded.then(payload => payload);

    // adjustments for CORS
    var parsedURL = new URL(url);
    parsedURL.hostname = parsedURL.hostname.replace('github.com', 'githubusercontent.com');
    parsedURL.hostname = parsedURL.hostname.replace('www.dropbox.com', 'dl.dropboxusercontent.com');

    return _loadResourcePromise(parsedURL.toString());
  }

  requestDriveFile(resolve, reject) {
    // if there's no this.timelineId then let's skip all this drive API stuff.
    if (!this.timelineId) return;

    return this.driveAPIloaded.then(_ => {
      var request = gapi.client.drive.files.get({
        fileId: this.timelineId
      });
      request.execute(this.fetchDriveFile.bind(this, resolve, reject));
    });
  }

  fetchDriveFile(resolve, reject, response) {
    document.title = `${response.originalFilename} | ${document.title}`;
    this.totalSize = +response.fileSize;

    if (response.error || !response.downloadUrl) {
      this.hideDevTools();
      this.statusElem.textContent = `Drive API error: ${response.message}`;
      return reject(new Error(response.message, response.error));
    }

    this.showDevTools();
    this.statusElem.textContent = 'Opening timeline file. Please wait...';
    var url = response.downloadUrl + '&alt=media'; // forces file contents in response body.
    this.downloadFile(url, function(payload) {
      if (payload === null) {
        this.hideDevTools();
        this.statusElem.textContent = 'Download of Drive asset failed.';
        return reject();
      }

      return resolve(payload);
    });
  }

  downloadFile(url, callback) {
    var accessToken = gapi.auth.getToken().access_token;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onprogress = this.updateProgress.bind(this);
    xhr.onload = _ => callback(xhr.responseText);
    xhr.onerror = _ => callback(null);
    xhr.send();
  }

  updateProgress(evt) {
    try {
      if (!this.loadingStarted) {
        this.loadingStarted = true;
        WebInspector.inspectorView.showPanel('timeline').then(panel => panel && panel.loadingStarted());
      }
      WebInspector.inspectorView.showPanel('timeline').then(panel => {
        panel && panel.loadingProgress(evt.loaded / this.totalSize);
      });
    } catch (e) {}
  }
}
