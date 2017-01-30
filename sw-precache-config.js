module.exports = {
  staticFileGlobs: [
    'docs/**.css',
    'docs/**.html',
    'docs/Images/**.*',
    'docs/**.js'
  ],
  runtimeCaching: [{
    urlPattern: /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/,
    handler: 'networkFirst'
  }],
  stripPrefix: 'docs/',
  verbose: true
};
