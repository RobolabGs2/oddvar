const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
	return {
		entry: "./src/index.ts",
		plugins: [
			new CleanWebpackPlugin(),
			new MiniCssExtractPlugin(),
			new HtmlWebpackPlugin({
				template: `./src/index.html`,
				chunks: ['main'],
				filename: `index.html`,
				meta: {
					viewport: "width=device-width",
					charset: "UTF-8"
				},
				hash: true,
				base: './',
				favicon: './favicon.png'
			}),
			// new CopyPlugin([
			// {from: './resources/*.png', to: './resources', flatten: true}
			// ]),
		],
		devtool: 'inline-source-map',
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: [
						{ loader: 'ts-loader', options: { transpileOnly: true } }
					],
					exclude: /node_modules/,
				},
				{
					test: /\.css$/i,
					use: [MiniCssExtractPlugin.loader, 'css-loader'],
				},
			],
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js'],
			modules: [path.resolve(__dirname, 'src'), 'node_modules']
		},
		output: {
			filename: '[name].bundle.js',
			path: path.resolve(__dirname, './static'),
		},
		optimization: {
			splitChunks: {
				chunks: 'all',
			},
			minimize: true,
			minimizer: [
				new UglifyJsPlugin({
					uglifyOptions: {
						mangle: false,
					},
				}),
			],
		},
	}
};