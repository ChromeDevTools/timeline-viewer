/* eslint-disable */

module.exports = {
  staticFileGlobs: [
    'docs/**.css',
    'docs/**.html',
    'docs/Images/**.*',
    'docs/**.js'
  ],
  runtimeCaching: [
    {
      // exclude googleapis, analitics, drive requests
      urlPattern: /^((?!(googleapis|analytics|googleusercontent)).)*$/,
      handler: 'networkFirst'
    },
    {
      // exclude googleapis, analitics, drive requests
      urlPattern: '/Images/(.*)',
      handler: (req, vals, opts) => {
        const appEnginePrefix = 'https://chrome-devtools-frontend.appspot.com/serve_file/@14fe0c24836876e87295c3bd65f8482cffd3de73/';
        var newReq = new Request(`${appEnginePrefix}Images/${vals[0]}`);
        return toolbox.cacheFirst(newReq, vals, opts);
      }
    }
  ],
  stripPrefix: 'docs/',
  verbose: true
};
