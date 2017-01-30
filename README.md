# DevTools Timeline Viewer
##### Shareable URLs for your Chrome DevTools Timeline traces.

Works with public github urls, github gists, and files on google drive (once authenticated).

---

Once authorized, you'll see Timeline Viewer as a registered Google Drive viewer when opening .json files. Once you select the Timeline Viewer, it will open in a new tab and load the timeline asset from your Drive.

![](https://cloud.githubusercontent.com/assets/39191/18080010/67390d9a-6e48-11e6-98a3-9c8c81b1df67.png)


You can share this URL with any users who ① have authorized [Timeline Viewer](https://chromedevtools.github.io/timeline-viewer/) to Drive with Google OAuth and ② have View permission to the Google Drive asset.

![image](https://cloud.githubusercontent.com/assets/39191/18080845/fb39f056-6e4b-11e6-90df-6cda94bd2495.png)


Visit your <a href="https://security.google.com/settings/security/permissions?pli=1">Google security permissions</a> if you'd like to revoke authorization.


## Dev

Run:
 - `yarn` or `npm i`
 - `yarn run dev` or `npm run dev` - it will open site in browser and run server for you.

Master branch's `docs` folder is what's published to gh-pages, to simplify deployment.

Auth keys have localhost:8000 whitelisted, so you can hack there.

* Private file: http://localhost:8000/?loadTimelineFromURL=0BzvYe7bYFf--aVhZM1RNR2N3cGc

### Updating Service Worker file

* `yarn run generate-sw` or `npm run generate-sw`

### Updating DevTools Version

* Remote debug Chrome on Android (Dev channel or Canary).
* (Verify it works as expected)
* Open devtools on devtools
* Look at `location.href` and grab the hash out of it
  * `copy(new URL(location.href).pathname.match(/@(\w+)/)[1])`
* Pop that into the hash in `docs/index.html`
