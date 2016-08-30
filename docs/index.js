var params = new URL(location.href).searchParams;
var timelineURL = params.get('loadTimelineFromURL');
var timelineId;

// if timelineURL isn't a real URL, then we'll save it to an ID
try {
    new URL(timelineURL);
} catch (e) {
    timelineId = timelineURL
}

var authBtn = document.getElementById('auth');

// called when apis.google script is done.
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

var driveAPIloaded;
function loadDriveApi() {
    driveAPIloaded = new Promise((resolve, reject) => {
        gapi.client.load('drive', 'v2', resolve);    
    });
}   

// This is defined in devtools' Runtime
_loadResourcePromise = loadResourcePromise
loadResourcePromise = function(url){ 
    // fallthrough
    if (url !== timelineId) return _loadResourcePromise(...arguments);
    // special handling for us..
    return driveAPIloaded.then(_ => {
        return new Promise((resolve, reject) => {
            openFile(resolve, reject);
        })
    })
}

function init(){
    if (!timelineURL) {
        document.getElementById('howto').style.display = 'block';
        return;
    }

    // show loading message..
    document.getElementById('opening').style.display = 'inline';
    
    // start devtools. 
    Runtime.startApplication("inspector");
}

function openFile (resolve, reject) {
    // if there's no timelineId then let's skip all this drive API stuff.
    if (!timelineId) return;

    var request = gapi.client.drive.files.get({
        fileId: timelineId
    });
    request.execute(function (response) {
        var url = response.downloadUrl + '&alt=media'; // forces file contents in response body.
        downloadFile(url, function(payload){  

            return resolve(payload);
            
            // ignore that rubbish
            // var fileparts = [payload];
            // var traceblob = new Blob(fileparts, {type : 'application/json'});

            // (function loopy() {
            //   if (window.WebInspector && WebInspector.panels && WebInspector.panels.timeline && WebInspector.panels.timeline._loadFromFile){
                

            //     WebInspector.panels.timeline._loadFromFile(traceblob);


            //   } else {
            //     setTimeout(loopy,50);
            //   }
            // })();
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

init();