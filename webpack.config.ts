import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import UglifyJsPlugin from 'uglifyjs-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import json5 from 'json5';
import webpack from 'webpack';

class BuildEnvironment {
	public readonly production: boolean;
	public get mode(): webpack.Configuration["mode"] {
		return this.production ? "production" : "development"
	}
	public get sourceMapNeeds(): boolean {
		return !this.production;
	}
	constructor({ production }: Record<string, boolean | number | string>) {
		this.production = production ? true : false
	}
}

const configFactory: webpack.ConfigurationFactory = (rawEnv) => {
	if (rawEnv !== undefined && typeof rawEnv !== "object") {
		throw new TypeError(`ENV expected object, actual: ${typeof rawEnv}`)
	}
	const env = new BuildEnvironment(rawEnv ? rawEnv : { prodaction: false });
	const config: webpack.Configuration = {
		mode: env.mode,
		entry: './src/client/index.ts',
		plugins: [
			new CleanWebpackPlugin(),
			new MiniCssExtractPlugin(),
			new HtmlWebpackPlugin({
				template: `./src/client/index.html`,
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
			new CopyPlugin({
				patterns: [{ from: './resources/*.json', to: './resources', flatten: true }]
			}),
			new ForkTsCheckerWebpackPlugin({ typescript: { configFile: 'src/client/tsconfig.json' } }),
		],
		devtool: env.sourceMapNeeds ? 'source-map' : undefined,
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
				},
				{
					test: /\.json$/i,
					type: 'json',
					parser: {
						parse: json5.parse,
					},
				},
			],
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js', '.scss', '.css'],
			modules: [path.resolve(__dirname, 'src'), 'node_modules'],
			alias: {
				"./test.json": "./test2.json"
			}
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
					sourceMap: env.sourceMapNeeds
				}),
			],
		},
	}
	return config;
};

export default configFactory;