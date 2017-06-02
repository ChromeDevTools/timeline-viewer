'use strict';

class GoogleAuth {
  constructor() {
    this.config = {
      scopes: [
        // 'https://www.googleapis.com/auth/drive.metadata.readonly',
        // 'https://www.googleapis.com/auth/drive.install',
        // 'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive'
      ],
      apiKey: 'AIzaSyCm6pJvqmwajgKlO2B0HW6veVRkvgoj308',
      clientId: '963139201929-9do1gni449dij7611muu9to5d0b6p9gh.apps.googleusercontent.com'
    };
  }
  checkAuth(callback) {
    const oAuthOptions = {
      fetch_basic_profile: false,
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' ')
    };

    gapi.load('client:auth2', () => {
      gapi.client.setApiKey(this.config.apiKey);

      // if we have no authinstance yet, initialize
      if (!this.getAuthInstance())
        return gapi.auth2.init(oAuthOptions).then(callback);

      // handle the click
      this.signIn().then(callback);
    });
  }
  isSignedIn() {
    return this.getAuthInstance().isSignedIn.get();
  }
  signIn(oAuthOptions) {
    return this.getAuthInstance().signIn(oAuthOptions);
  }
  signOut() {
    try {
      this.getAuthInstance().signOut();
    } catch(e) {}
  }
  getAuthInstance() {
    return gapi.auth2.getAuthInstance();
  }
}
