const HtmlWebpackPlugin = require('html-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const path = require('path');

module.exports = {
  entry: './src/index.js',
  mode: 'development',
  devServer: {
    port: 3004, // Host runs on port 3000
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    },
  },
  output: {
    publicPath: 'auto',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: { presets: ['@babel/preset-env', '@babel/preset-react'] },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', {
          loader: 'postcss-loader',
          options: { postcssOptions: { plugins: [require('tailwindcss'), require('autoprefixer')] } },
        }],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        mfe_user: 'mfe_user@http://localhost:3001/remoteEntry.js',
        mfe_book: 'mfe_book@http://localhost:3002/remoteEntry.js',
        mfe_transactions: 'mfe_transactions@http://localhost:3003/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, eager: true, requiredVersion: '^17.0.2' },
        'react-dom': { singleton: true, eager: true, requiredVersion: '^17.0.2' },
        axios: { singleton: true, eager: true, requiredVersion: '^1.6.8' },
      },
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html'
    }),
  ],
};