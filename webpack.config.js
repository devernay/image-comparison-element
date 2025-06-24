const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: './public/js/image-comparison-element.js',
    output: {
      filename: isProduction ? 'image-comparison-element.min.js' : 'image-comparison-element.js',
      path: path.resolve(__dirname, 'public/js'),
    },
    devtool: isProduction ? false : 'source-map',
    watch: false,
    optimization: {
      minimize: isProduction,
    },
  };
};
