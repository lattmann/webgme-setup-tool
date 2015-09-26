/*globals describe,it,before,after*/
var BaseManager = require('../src/BaseManager'),
    Logger = require('../src/Logger'),
    fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    _ = require('lodash'),
    rm_rf = require('rimraf'),
    nop = function(){};

var logger = new Logger(),
    emitter = logger._emitter,
    manager = new BaseManager(logger);

var WebGMEConfig = 'config.webgme.js',
    SETUP_CONFIG = 'webgme-setup.json';

var PROJECT_DIR,
    TMP_DIR = path.join(__dirname, '..', 'test-tmp');

describe('BaseManager', function() {
    'use strict';

    before(function() {
        process.chdir(__dirname);
    });

    // Creating a new item from boilerplate
    describe('basic commands', function() {
        PROJECT_DIR = path.join(TMP_DIR, 'ExampleProject');
        before(function(done) {
            // Create tmp directory in project root
            if (!fs.existsSync(TMP_DIR)) {
                fs.mkdir(TMP_DIR, function() {
                    process.chdir(TMP_DIR);
                    done();
                });
            } else {
                rm_rf(TMP_DIR, function() {
                    fs.mkdir(TMP_DIR, function() {
                        process.chdir(TMP_DIR);
                        done();
                    });
                });
            }
        });

        describe('init', function() {

            before(function(done) {
                process.chdir(TMP_DIR);
                manager.init({name: PROJECT_DIR}, function() {
                    process.chdir(PROJECT_DIR);
                    done();
                });
            });

            it('should create a new directory with project name', function() {
                assert(fs.existsSync(PROJECT_DIR));
            });

            it('should create (valid) globals test fixture', function() {
                var fixturePath = path.join(PROJECT_DIR, 'test', 'globals.js');
                assert(fs.existsSync(fixturePath));
            });

            it('should create a src and test dirs', function() {
                var res = ['src', 'test']
                    .map(function(dir) {
                        return path.join(PROJECT_DIR, dir);
                    })
                    .map(fs.existsSync)
                    .forEach(assert);
            });

            it('should create a webgme-setup.json file in project root', function() {
                assert(fs.existsSync(path.join(PROJECT_DIR, 'webgme-setup.json')));
            });

            it('should initialize an npm project', function() {
                var packageJSON = path.join(PROJECT_DIR, 'package.json');
                assert(fs.existsSync(packageJSON));
            });

            it('should name the npm project appropriately', function() {
                var packageJSON = path.join(PROJECT_DIR, 'package.json');
                var pkg = require(packageJSON);
                assert.equal(pkg.name, 'ExampleProject'.toLowerCase());
            });

            it('should add the webgme as a dependency', function() {
                var packageJSON = path.join(PROJECT_DIR, 'package.json');
                var deps = require(packageJSON).dependencies;
                assert(deps.hasOwnProperty('webgme'));
            });

            it.skip('should use the latest release of webgme', function() {
            });

            it('should create webgme app.js file', function() {
                var app = path.join(PROJECT_DIR, 'app.js');
                assert(fs.existsSync(app));
            });

            it('should throw error if no project name', function(done) {
                emitter.once('error', function(msg) {
                    done();
                });
                manager.init({}, nop);
            });

            // issue 15
            it('should pretty printed webgme-setup.json', function() {
                var config = path.join(PROJECT_DIR, 'webgme-setup.json'),
                    content = fs.readFileSync(config, 'utf8');
                // Check that it is printed on multiple lines
                assert(content.split('\n').length > 3);
            });

            // WebGME config
            describe('WebGME config', function() {
                var CONFIG_DIR = path.join(PROJECT_DIR, 'config');

                it('should create config directory', function() {
                    assert(fs.existsSync(CONFIG_DIR));
                });

                it('should create a webgme config file', function() {
                    var config = path.join(CONFIG_DIR, WebGMEConfig);
                    assert(fs.existsSync(config));
                });

                it('should create editable (boilerplate) webgme config file', function() {
                    var config = path.join(CONFIG_DIR, 'config.default.js');
                    assert(fs.existsSync(config));
                });
            });

            it('should fail f the dir exists', function() {
                manager.init({name: PROJECT_DIR}, function(err) {
                    assert(!!err);
                });
            });
        });

        describe('init w/o args', function() {
            
            it('should create webgme project in current directory', function(done) {
                PROJECT_DIR = path.join(TMP_DIR, 'InitNoArgs');
                fs.mkdirSync(PROJECT_DIR);
                process.chdir(PROJECT_DIR);
                manager.init({}, function() {
                    var configPath = path.join(PROJECT_DIR, SETUP_CONFIG);
                    assert(fs.existsSync(configPath));
                    done();
                });
            });

            it('should fail if dir is nonempty', function(done) {
                PROJECT_DIR = path.join(TMP_DIR, 'InitNoArgsFail');
                fs.mkdirSync(PROJECT_DIR);
                process.chdir(PROJECT_DIR);
                fs.writeFileSync(path.join(PROJECT_DIR, 'temp'), 'stuff');
                manager.init({}, function(err) {
                    var configPath = path.join(PROJECT_DIR, SETUP_CONFIG);
                    assert(!fs.existsSync(configPath));
                    assert(!!err);
                    done();
                });
            });
        });

        after(function(done) {
            if (fs.existsSync(PROJECT_DIR)) {
                rm_rf(PROJECT_DIR, done);
            } else {
                done();
            }
        });
    });
});
