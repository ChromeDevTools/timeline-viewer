/* eslint-disable */

module.exports = {
  staticFileGlobs: [
    'docs/**.css',
    'docs/**.html',
    'docs/Images/**.*',
    'docs/**.js'
  ],
  runtimeCaching: [{
    // exclude googleapis, analitics, drive requests
    urlPattern: /^((?!(googleapis|analytics|googleusercontent)).)*$/,
    handler: 'networkFirst'
  }],
  stripPrefix: 'docs/',
  verbose: true
};
