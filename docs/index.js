// todo: 
// 2. use the loadingStarted UI

class Viewer {

  constructor() {
    this.params = new URL(location.href).searchParams;
    this.timelineURL = this.params.get('loadTimelineFromURL');
    this.timelineId;
    this.totalSize = 50 * 1000 * 1000;
    this.loadingStarted = false;

    // if timelineURL isn't a real URL, then we'll save it to an ID
    try {
      new URL(this.timelineURL);
    } catch (e) {
      this.timelineId = this.timelineURL
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
      document.getElementById('howto').style.display = 'block';
      return;
    }

    // show loading message..
    document.getElementById('opening').style.display = 'inline';
    
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
    if (authResult && !authResult.error) {
      this.authBtn.style.display = 'none';
      gapi.client.load('drive', 'v2', this.driveAPIloadedresolve);
    } else {
      // auth error.
      this.authBtn.style.display = 'inline';
      document.getElementById('howto').style.display = 'block';
      return new Error(`Google auth error: ${authResult.error}: ${authResult.error_subtype}`);
    }
  }

  loadResourcePromise(url) {
    // fallthrough
    if (url !== this.timelineId) return _loadResourcePromise(...arguments);
    // special handling for us..
    return this.driveFileLoaded.then(payload => payload);
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

    if (response.error || !response.downloadUrl)
      return reject(new Error(response.message, response.error));

    var url = response.downloadUrl + '&alt=media'; // forces file contents in response body.
    this.downloadFile(url, function(payload) {  
      if (payload === null) 
        return reject(new Error('Download of drive asset failed'));

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
