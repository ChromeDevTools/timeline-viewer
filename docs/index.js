var authBtn = document.getElementById('auth');

function checkAuth() {
    gapi.auth.authorize({
        'client_id': config.clientId,
        'scope': config.scopes.join(' '),
        'immediate': true
    }, handleAuthResult);
}

function handleAuthResult(authResult) {
    if (authResult && !authResult.error) {
        loadDriveApi();
        authBtn.style.display = 'none';
    } else {
        authBtn.style.display = 'inline';
        document.getElementById('howto').style.display = 'block';
    }
}

function handleAuthClick(event) {
    gapi.auth.authorize({
        client_id: config.clientId, 
        scope: config.scopes.join(' '), 
        immediate: false
    }, handleAuthResult);
    return false;
}

function loadDriveApi() {
    gapi.client.load('drive', 'v2', openFile);
}   

function openFile () {
    if (location.href.split('?').length < 2) {
        document.getElementById('howto').style.display = 'block';
        return;
    }
    document.getElementById('opening').style.display = 'inline';
    var id = location.href.split('?')[1].split('=')[1];
    var request = gapi.client.drive.files.get({
        fileId: id
    });
    request.execute(function (response) {
        var url = response.downloadUrl + '&alt=media'; // forces file contents in response body.
        downloadFile(url, function(payload){  
            var fileparts = [payload];
            var traceblob = new Blob(fileparts, {type : 'application/json'});

            (function loopy(){
              if (window.WebInspector && WebInspector.panels && WebInspector.panels.timeline && WebInspector.panels.timeline._loadFromFile){
                WebInspector.panels.timeline._loadFromFile(traceblob);
              } else {
                setTimeout(loopy,50);
              }
            })();
        });
    })
}

function downloadFile(url, callback) {
  if (url) {
    var accessToken = gapi.auth.getToken().access_token;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onload = function() {
      callback(xhr.responseText);
    };
    xhr.onerror = function() {
      callback(null);
    };
    xhr.send();
  } else {
    callback(null);
  }
}