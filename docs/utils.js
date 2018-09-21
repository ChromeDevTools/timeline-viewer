'use strict';

// eslint-disable-next-line no-unused-vars
class Utils {
  fetch(url, params, CORSFlag = false) {
    if (CORSFlag) {
      return this.doCORSRequest(url, params.method, params.body, params.addRequestHeaders, params.onprogress);
    } else {
      return fetch(url, params);
    }
  }
  doCORSRequest(url, method='GET', body, addRequestHeaders, onprogress) {
    return new Promise((resolve, reject) => {
      // Use an XHR rather than fetch so we can have progress events
      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open(method, url);
      addRequestHeaders && addRequestHeaders(xhr);
      // show progress only while getting data
      if (method === 'GET') {
        xhr.onprogress = onprogress;
      }
      xhr.onload = _ => {
        resolve(xhr);
      };
      xhr.onerror = error => {
        reject(error, xhr);
      };
      xhr.send(body);
    });
  }
}
