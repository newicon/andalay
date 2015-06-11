module.exports = function (grunt) {
	'use strict';

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		files: {
			src: ['src/andalay.js'],
			test: ['test/*.spec.js']
		},
		build_dir: 'dist',
		jshint: {
			options: {
			},
			all: ['Gruntfile.js', '<%= files.src %>']
		},
		uglify: {
			options: {
				preserveComments: 'some'
			},
			main: {
				files: {
					'<%= build_dir %>/andalay.min.js': ['src/andalay.js']
				}
			}
		},
		watch: {
			andalay: {
				files: ['<%= files.src %>', '<%= files.test %>'],
				tasks: ['jshint:all', 'karma:unit:watch', 'doxx']
			}
		},
		karma: {
			'unit': {
				configFile: 'karma.conf.js',
				singleRun: true
			},
			'watch': {
				configFile: 'karma.conf.js',
				background: true,		
			}
		},
		doxx: {
			all: {
				src: 'src/',
				target: './',
				options: {
					template: 'docs/template.jade'
				}
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-karma');
	grunt.loadNpmTasks('grunt-doxx');

	grunt.registerTask('test', ['karma:unit']);
	grunt.registerTask('build', [
		'jshint:all',
		'karma:unit',
		'doxx:all',
		'uglify:main'
	]);
	grunt.registerTask('default', ['karma:watch', 'watch', 'doxx:all', 'uglify:main']);
};