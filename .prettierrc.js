module.exports = {
  singleQuote: true,
  trailingComma: 'all',
  plugins:
    // HACK: prettier-plugin-jsdoc doesn't work with prettier@2 which used by jest.
    //       Don't use it while testing. Also the plugin name is modified to avoid
    //       plugin auto searching feature of prettier@2.
    process.env.JEST_WORKER_ID === undefined && process.env.NODE_ENV !== 'test'
      ? ['prettier-3-plugin-jsdoc']
      : [],
  tsdoc: true,
};
