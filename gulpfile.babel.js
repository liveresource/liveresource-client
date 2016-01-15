'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var babelify = require('babelify');
var header = require('gulp-header');
var rename = require('gulp-rename');
var replace = require('gulp-replace');

var pkg = require('./package.json');

var doBuild = function(options) {

    var {debug, entryPoint, expose, fileNameBase} = options;

    // Build banner
    var banner = [`/*!`,
        ` * ${ pkg.description } v${ pkg.version }`,
        ` * (c) ${ pkg.author } - ${ pkg.homepage }`,
        ` * License: ${ pkg.licenses[0].type } (${ pkg.licenses[0].url })`,
        ` */`,
    ``].join('\n');
    
    var headerTask = header(banner);

    // set up the browserify instance on a task basis
    var b = browserify(entryPoint, { debug, standalone: expose, paths: [ './node_modules', './src', './lib' ] })
        .transform(babelify, { presets: ['es2015'], plugins: ['add-module-exports'] });

    var pipe = b.bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source(fileNameBase))
        .pipe(rename(function(path) {
            path.basename = path.basename + '-latest';
            path.extname = ".js";
            if (!debug) {
                path.extname = ".min" + path.extname;
            }
        }))
        .pipe(buffer());

    if (debug) {
        pipe = pipe.pipe(sourcemaps.init({loadMaps: true}));
    }

    if (!debug) {
        pipe = pipe.pipe(uglify());
    }

    pipe = pipe.pipe(headerTask);

    if (debug) {
        pipe = pipe.pipe(sourcemaps.write('./'));
    }

    return pipe.pipe(gulp.dest('./build/output'));
};

var doBuildLiveResource = function(debug) {
    return doBuild({entryPoint: './src/main.js', expose: 'LiveResource', fileNameBase: 'liveresource', debug});
};

gulp.task('default', [ 'dist' ]);

gulp.task('dist', [ 'build' ], function () {
    var {version} = pkg;

    gulp.src('./build/output/**')
        .pipe(rename(function(path) {
            var extPos = path.basename.indexOf('.');
            if (extPos >= 0) {
                var ext = path.basename.substring(extPos);
                path.basename = path.basename.substring(0, extPos);
                path.extname = ext + path.extname;
            }

            var pos = path.basename.lastIndexOf('-latest');
            if (pos >= 0) {
                path.basename = path.basename.substring(0, pos) + '-' + version;
            }
        }))
        .pipe(replace(/^\/\/# sourceMappingURL=(.*)-latest\.js\.map$/gm, `//# sourceMappingURL=$1-${version}.js.map`))
        .pipe(gulp.dest('./dist'));
});

gulp.task('build-debug', function () {
    return doBuildLiveResource(true);
});

gulp.task('build-min', function () {
    return doBuildLiveResource(false);
});

gulp.task('build', [ 'build-debug', 'build-min' ]);
