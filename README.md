# DevTools Timeline Viewer
##### Shareable URLs for your Chrome DevTools Timeline traces.

![drawing 1](https://user-images.githubusercontent.com/6231516/27319720-79933930-559b-11e7-8656-a1fa3c4a1697.png)

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

Auth keys have localhost:8833 whitelisted, so you can hack there.

* Private file: http://localhost:8833/?loadTimelineFromURL=drive://0BzvYe7bYFf--aVhZM1RNR2N3cGc

## Updating DevTools Version

* Remote debug Chrome on Android (Dev channel or Canary).
* (Verify it works as expected)
* Open devtools on devtools
* Look at `location.href` and grab the hash out of it
  * `copy(new URL(location.href).pathname.match(/@(\w+)/)[1])`
* Pop that into the hash in `docs/index.html`

### DevTools / Chrome version compatibility

- chrome 79/80/+ (a9b97dff480d5c50843b5190c4d02373a0fc6d84) breaks in our setup. appears to be a decent amount of work to fix.
- chrome 78 (675968a8c657a3bd9c1c2c20c5d2935577bbc5e6 was base commit) is fine
- chrome 70 (81bf34f6bd3784247d7787d879821061c1b7484b) was fine until the removal of custom elements shipped and broke clientside in chrome 80

I sometimes use the archive of https://chromereleases.googleblog.com/ to find a target chrome version.

## Testing

[Cypress](https://cypress.io) is used for integration testing.
To run test just invoke `yarn test`

