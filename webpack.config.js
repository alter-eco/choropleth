const path = require('path');
const webpack = require('webpack');

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

// const dateFormat = require('dateformat');

// const pkg = require('./package.json');

module.exports = function(env, argv) {
  if (argv.mode === 'production') {

  }

  // plugins.push(new webpack.BannerPlugin({
  //   banner: pkg.name + ' ' + pkg.version + ' built on: ' + dateFormat(new Date()) + ' [hash]'
  // }));

  // output: {
  //   library: "MyLibrary",
  //   libraryTarget: "umd"
  // }
  return {
    entry: [
      './index.js',
    ],
    devtool: 'source-map',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['babel-preset-env']
            }
          }
        }
      ]
    },
    optimization: {
      minimize: false
    },
    plugins: [
      new UglifyJsPlugin({
        sourceMap: true
      })
    ]
  };
};
