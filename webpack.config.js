const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: './temp/js/image-comparison-element.js',
    output: {
      filename: 'image-comparison-element.js',
      path: path.resolve(__dirname, 'public/js'),
    },
    devtool: isProduction ? false : 'source-map',
    watch: false,
    optimization: {
      minimize: isProduction,
    },
  };
};
