/*global module:false*/
/*
Gruntfile, heavily inspired from that of KnockoutJS
https://github.com/knockout/knockout.git
*/
module.exports = function(grunt) {
    var _ = grunt.util._;

    // Project configuration
    grunt.initConfig({
        // Metadata
        pkg: grunt.file.readJSON('package.json'),
        fragments: './build/fragments/',
        banner: '/*!\n' +
        ' * LiveResource library v<%= pkg.version %>\n' +
        ' * (c) <%= pkg.author %> - <%= pkg.homepage %>\n' +
        ' * License: <%= pkg.licenses[0].type %> (<%= pkg.licenses[0].url %>)\n' +
        ' */\n\n',

        build: {
            debug: './build/output/liveresource-latest.js',
            min: './build/output/liveresource-latest.min.js'
        },
        dist: {
            debug: './dist/liveresource-<%= pkg.version %>.js',
            min: './dist/liveresource-<%= pkg.version %>.min.js'
        }
    });

    grunt.registerTask('clean', 'Clean up output files.', function (target) {
        var output = grunt.config('build');
        var files = [ output.debug, output.min ];
        var options = { force: (target == 'force') };
        _.forEach(files, function (file) {
            if (grunt.file.exists(file))
                grunt.file.delete(file, options);
        });
        return !this.errorCount;
    });

    function getReferencedSources(sourceReferencesFilename) {
        // Returns the array of filenames referenced by a file like source-references.js
        var result;
        global.sourceReferencesCallback = function(sources) { result = sources; };
        eval(grunt.file.read(sourceReferencesFilename));
        return result;
    }

    function getCombinedSources(debug) {
        var fragments = grunt.config('fragments'),
            sourceFilenames = [
                fragments + 'amd-pre.js',
                getReferencedSources(fragments + 'source-references.js'),
                fragments + 'amd-post.js',
            ],
            flattenedSourceFilenames = Array.prototype.concat.apply([], sourceFilenames),
            combinedSourceContents = flattenedSourceFilenames.map(function(filename) {
                return grunt.file.read('./' + filename);
            });
        if (debug) {
            combinedSourceContents.unshift('var DEBUG=true;');
        }
        var combinedSources = combinedSourceContents.join('\n');

        return combinedSources.replace('##VERSION##', grunt.config('pkg.version'));
    }

    function buildOutput(contents) {
        var source = [];
        source.push(grunt.config('banner'));
        source.push('(function(){\n');
        source.push(contents);
        source.push('})();\n');
        return source.join('').replace(/\r\n/g, '\n');
    }

    function buildDebug(output) {
        grunt.file.write(output, buildOutput(getCombinedSources(true)));
    }

    function buildMin(output, done) {
        var UglifyJs = require('uglify-js');

        var options = {
            fromString: true,
            compress: {
                global_defs: {
                    DEBUG: false
                }
            }
        };
        grunt.log.write('Compiling...');
        var result = UglifyJs.minify(getCombinedSources(false), options);
        grunt.log.ok();
        grunt.file.write(output, buildOutput(result.code).replace(/\r\n/g, '\n'));
        done(true);
    }

    grunt.registerMultiTask('build', 'Build', function() {
        if (!this.errorCount) {
            var output = this.data;
            if (this.target === 'debug') {
                buildDebug(output);
            } else if (this.target === 'min') {
                buildMin(output, this.async());
            }
        }
        return !this.errorCount;
    });

    grunt.registerTask('dist', ['build'], function() {

        var buildConfig = grunt.config('build'),
            distConfig = grunt.config('dist');
        grunt.file.copy(buildConfig.debug, distConfig.debug);
        grunt.file.copy(buildConfig.min, distConfig.min);

    });

    // Default task.
    grunt.registerTask('default', ['clean', 'build', 'dist']);
};