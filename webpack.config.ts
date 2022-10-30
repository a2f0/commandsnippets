import {Configuration, ProvidePlugin} from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';

const config: Configuration = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'build'),
    publicPath: '/',
    filename: '[name].[contenthash].bundle.js',
    clean: true,
  },
  devtool: 'eval',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    fallback: {
      url: false,
      http: false,
      https: false,
      // eslint-disable-next-line node/no-unpublished-require
      stream: require.resolve('stream-browserify'),
      assert: false,
      zlib: false,
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve('./index.html'),
      favicon: './public/favicon.svg',
    }),
    new ProvidePlugin({
      // https://github.com/browserify/node-util/issues/57
      process: 'process',
    }),
  ],
};

export default config;
