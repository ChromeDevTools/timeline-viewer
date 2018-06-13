'use strict';

const STORAGE_TYPES = {
  G_DRIVE: 'Google Drive',
  FIREBASE: 'Firebase'
};

// eslint-disable-next-line no-unused-vars
class GoogleDrive {
  constructor() {
    this.utils = new Utils();
  }
  uploadData(fileName = `Timeline-data-${Date.now()}`, data) {
    const contentType = 'application/octet-stream';

    const fileMetadata = {
      title: fileName,
      mimeType: contentType,
      writersCanShare: true,
      uploadType: 'multipart'
    };
    const media = {
      mimeType: contentType,
      body: data
    };

    const boundary = Math.random().toString().substr(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    // much prettier then template literals because of mess with LF
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: ' + contentType + '\r\n\r\n' +
      media.body +
      closeDelim;

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${GoogleAuth.getUserAccessToken()}`);
    headers.append('Content-type', `multipart/mixed; charset=utf-8; boundary=${boundary}`);

    const request = gapi.client.request({
      path: '/upload/drive/v2/files',
      method: 'POST',
      params: {
        uploadType: 'multipart'
      },
      headers: {
        'Authorization': `Bearer ${GoogleAuth.getUserAccessToken()}`,
        'Content-type': `multipart/mixed; charset=utf-8; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
    return new Promise(resolve => request.execute(resolve));
  }
  insertPermission(fileId, type = 'anyone', role = 'writer') {
    const url = new URL(`https://www.googleapis.com/drive/v2/files/${fileId}/permissions`);
    const body = {
      role: role,
      type: type
    };
    url.searchParams.append('key', GoogleAuth.apiKey);

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${GoogleAuth.getUserAccessToken()}`);
    headers.append('Content-Type', 'application/json');

    // todo const request = gapi.client.drive.permissions.insert({
    return this.utils.fetch(url.toString(), {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
  }
}

class FirebaseStorage {
  constructor() {
    var config = {
      // add config
    };
    firebase.initializeApp(config);
  }

  uploadData(filename, data) {
    const storageRef = firebase.storage().ref();
    const traceRef = storageRef.child(`traces/${filename}`);
    const uploadTask = traceRef.putString(data);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', function(snapshot){
        // Observe state change events such as progress, pause, and resume
        // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
        switch (snapshot.state) {
          case firebase.storage.TaskState.PAUSED: // or 'paused'
            console.log('Upload is paused');
            break;
          case firebase.storage.TaskState.RUNNING: // or 'running'
            console.log('Upload is running');
            break;
        }
      }, function(error) {
        // Handle unsuccessful uploads
        reject(error);
      }, function() {
        // Handle successful uploads on complete
        // For instance, get the download URL: https://firebasestorage.googleapis.com/...
        uploadTask.snapshot.ref.getDownloadURL()
          .then(function(downloadURL) {
            resolve(downloadURL);
          });
      });
    });
  }
}
