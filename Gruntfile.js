'use strict';

module.exports = function(grunt) {
  var CI = grunt.option('ci');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    project: {
      lib: 'lib',
      test: 'test',
      dist: 'dist',
      bin: 'bin',
      data: 'data',
      name: 'esn-elasticsearch-configuration'
    },

    babel: {
      options: {
        sourceMap: false,
        presets: ['es2015'],
        plugins: ['add-module-exports']
      },
      dist: {
        files: [
          {
            expand: true,
            src: [
              '<%= project.lib %>/**/*.js',
              '<%= project.bin %>/**/*.js',
              '<%= project.test %>/**/*.js'
            ],
            dest: '<%= project.dist %>/'
          }
        ]
      }
    },

    copy: {
      data: {
        files: [
          {
            expand: true,
            src: ['<%= project.data %>/**'],
            dest: '<%= project.dist %>/'
          }
        ],
      }
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: CI && 'checkstyle',
        reporterOutput: 'jshint.xml'
      },
      all: {
        src: [
          'Gruntfile.js',
          '<%= project.test %>/**/*.js',
          '<%= project.lib %>/**/*.js',
          '<%= project.bin %>/**/*.js'
        ]
      }
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          captureFile: 'results.txt',
          quiet: false,
          clearRequireCache: false
        },
        src: ['<%= project.dist %>/test/**/*.js']
      }
    },

    watch: {
      files: ['<%= jshint.all.src %>'],
      tasks: ['test']
    },

    jscs: {
      lint: {
        options: {
          config: '.jscsrc'
        },
        src: ['<%= jshint.all.src %>']
      },
      fix: {
        options: {
          config: '.jscsrc',
          fix: true
        },
        src: ['<%= jshint.all.src %>']
      }
    },

    lint_pattern: {
      options: {
        rules: [
          { pattern: /(describe|it)\.only/, message: 'Must not use .only in tests' }
        ]
      },
      all: {
        src: ['<%= jshint.all.src %>']
      }
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '<%= project.dist %>/*',
            '!<%= project.dist %>/.git*'
          ]
        }]
      }
    }
  });

  require('load-grunt-tasks')(grunt);

  grunt.registerTask('compile', 'Compile from ES6 to ES5', ['clean:dist', 'copy:data', 'babel']);
  grunt.registerTask('linters', 'Check code for lint', ['jshint:all', 'jscs:lint', 'lint_pattern:all']);
  grunt.registerTask('package', 'Package module', ['clean:dist', 'linters', 'copy:data', 'babel']);
  grunt.registerTask('test', ['package', 'mochaTest']);
  grunt.registerTask('dev', 'Launch tests then for each changes relaunch it', ['test', 'watch']);
  grunt.registerTask('default', ['test']);
};
