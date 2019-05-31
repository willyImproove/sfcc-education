const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const webpack = require('webpack');
const WebpackExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackStyleLintPlugin = require('stylelint-webpack-plugin');
const WebpackCleanPlugin = require('clean-webpack-plugin');
const WebpackOnBuildPlugin = require('on-build-webpack');
const WebpackBuildNotifierPlugin = require('webpack-build-notifier');


class WebpackBundle {
    static forCartridge(env, cartridge) {
        let nodeModulesPath = path.resolve(__dirname, 'node_modules');
        let cartridgesPath = path.resolve(__dirname, 'cartridges');
        let srcPath = path.resolve(cartridgesPath, cartridge, 'cartridge/client');
        if (!fse.existsSync(srcPath)) {
            return;
        }
        let bundle = {};
        bundle.name = cartridge;
        bundle.stats = { children: false };
        bundle.entry = {};

        let srcJsGlob = path.join(srcPath, '*', 'js', '*.js');
        glob.sync(srcJsGlob)
            .forEach((f) => {
                let key = path.join(
                    path.dirname(path.relative(srcPath, f)),
                    path.basename(f, '.js')
                );
                bundle.entry[key] = f;
            }
            );
        let srcScssGlob = path.join(srcPath, '*', 'scss', '**', '*.scss');

        glob.sync(srcScssGlob)
            .filter(f => !path.basename(f).startsWith('_'))
            .forEach((f) => {
                let key = path.join(
                    path.dirname(path.relative(srcPath, f)),
                    path.basename(f, '.scss')
                );
                bundle.entry[key] = f;
            });


        bundle.output = {
            path: path.resolve(
                cartridgesPath,
                cartridge,
                'cartridge',
                'static'
            ),
            filename: '[name].js'
        };


        bundle.module = {
            rules: [
                {
                    test: /\.js$/,
                    loader: 'eslint-loader',
                    enforce: 'pre'
                },
                {
                    test: /\.js$/,
                    loader: 'babel-loader?presets[]=es2015',
                    options: {
                        babelrc: true
                    }
                },
                {
                    test: /\.scss$/,
                    loader: WebpackExtractTextPlugin.extract([
                        { loader: 'css-loader?-url' },
                        { loader: 'sass-loader?includePaths[]=' + encodeURIComponent(nodeModulesPath) }
                    ])
                }
            ]
        };

        bundle.plugins = [];
        bundle.plugins.push(new WebpackStyleLintPlugin());
        let pathRegSep = path.sep === '\\' ? '\\\\' : '\\/';
        let pathRegExp = new RegExp('^(.+?)' + pathRegSep + 'scss' + pathRegSep);


        bundle.plugins.push(
            new WebpackExtractTextPlugin(
                {
                    allChunks: true,
                    filename: (getPath) => {
                        let cssPath = getPath('[name].css');
                        return cssPath.replace(pathRegExp, '$1' + path.sep + 'css' + path.sep);
                    }
                }
            )
        );


        bundle.plugins.push(
            new WebpackCleanPlugin(
                [
                    '*/js',
                    '*/css'
                ],
                {
                    root: path.resolve(cartridgesPath, cartridge, 'cartridge', 'static'),
                    verbose: false
                }
            )
        );


        if (env === 'prd') {
            bundle.plugins.push(new WebpackOnBuildPlugin((stats) => {
                let cleanScssPath = path.resolve(
                    cartridgesPath,
                    cartridge,
                    'cartridge',
                    'static',
                    '*',
                    'scss'
                );
                glob.sync(cleanScssPath).forEach((d) => {
                    fse.removeSync(d);
                });
            }));


            bundle.plugins.push(new webpack.optimize.UglifyJsPlugin({
                minimize: true,
                sourceMap: false,
                compress: { drop_console: true },
                mangle: { except: ['$', 'exports', 'require'] }
            }));
        }


        if (env === 'dev') {
            bundle.plugins.push(new WebpackBuildNotifierPlugin({
                title: 'MFRA_PASE',
                suppressSuccess: true
            }));
            bundle.devtool = 'source-map';
        }

        return bundle;
    }
}


module.exports = (env, args) => {
    return [
        WebpackBundle.forCartridge(env, 'app_improove')
    ];
};
