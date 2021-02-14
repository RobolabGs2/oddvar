const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = (env) => {
	// development mode by default
	env = env ? env : { production: false }
	return {
		mode: env.production ? 'production' : 'development',
		entry: './src/index.ts',
		plugins: [
			new CleanWebpackPlugin(),
			new MiniCssExtractPlugin(),
			new HtmlWebpackPlugin({
				template: `./src/index.html`,
				chunks: ['main'],
				filename: `index.html`,
				meta: {
					viewport: 'width=device-width',
					charset: 'UTF-8'
				},
				hash: true,
				base: './',
				favicon: './favicon.png'
			}),
			new CopyPlugin([
				{ from: './resources/*.json', to: './resources', flatten: true }
			]),
			new ForkTsCheckerWebpackPlugin({ typescript: { configFile: 'src/tsconfig.json' } }),
		],
		devtool: env.production ? 'none' : 'source-map',
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
				{
					test: /\.s[ac]ss$/i,
					use: [
						MiniCssExtractPlugin.loader,
						// Translates CSS into CommonJS
						'css-loader',
						// Compiles Sass to CSS
						'sass-loader',
					],
				}
			],
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js', '.scss', '.css'],
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
			minimize: env.production,
			minimizer: [
				new UglifyJsPlugin({
					uglifyOptions: {
						mangle: false,
					},
					sourceMap: !env.production
				}),
			],
		},
	}
};