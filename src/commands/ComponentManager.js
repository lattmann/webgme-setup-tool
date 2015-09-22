/*globals define*/
/*
 * This is the basic structure for component managers
 *
 * In the component manager, all public functions (functions not preceded by a _)
 * are assumed to be actions accepted from the command line.
 *
 * Note: "init" is a reserved action and cannot be used by the ComponentManager
 */

define(['rimraf',
        'path',
        'fs',
        'module',
        'child_process',
        'plural',
        'commands/../utils'], function(rm_rf,
                                       path,
                                       fs,
                                       module,
                                       childProcess,
                                       plural,
                                       utils) {
    'use strict';

    var spawn = childProcess.spawn,
        nodeRequire = require.nodeRequire,
        __dirname = path.dirname(module.uri);

    var ComponentManager = function(name, logger) {
        this._logger = logger;
        this._name = name;  // Name to be used in cli usage, etc
        this._group = plural(name);  // Plural version of name
        this._webgmeName = name;  // Name to be used only in webgme config
        this._prepareWebGmeConfig();
    };

    /**
     * List the currently recognized components.
     *
     * @param args
     * @param callback
     * @return {undefined}
     */
    ComponentManager.prototype.ls = function(args, callback) {
        var config = utils.getConfig(),
            plugins = Object.keys(config.components[this._group]).join(' ') || '<none>',
            deps = Object.keys(config.dependencies[this._group]).join(' ') || '<none>';

        this._logger.write('Detected '+this._group+': '+plugins+
            '\nThird party '+this._group+': '+deps);
        callback(null);
    };

    ComponentManager.prototype.rm = function(args, callback) {
        // TODO: Check args
        var name = args._[2],
            config = utils.getConfig(),
            type = config.components[this._group][name] !== undefined ? 
                'components' : 'dependencies';

        // Remove from config files
        this._removeFromConfig(name, type);

        // Remove any actual files
        if (type === 'components') {
            // Remove the name directories from src, test
            var components = config[type][this._group],
				paths = Object.keys(components[name]),
                remaining = paths.length,
                finished = function() {
                    if (--remaining === 0) {
                        return callback();
                    }
                };
            paths.forEach(function(pathType) {
                var componentPath = components[name][pathType].replace(/\//g, path.sep);
                this._logger.info('Removing '+componentPath);
                rm_rf(componentPath, finished);
            }, this);
        } else {
            callback();
        }
    };

    // TODO: Refactor this
    ComponentManager.prototype.add = function(args, callback) {
        var project,
            componentName,
            pkgPath,
            pkgContent,
            projectRoot = utils.getRootPath(),
            pkg,
            job;

        if (args._.length < 4) {
            return this._logger.error(
            'Usage: webgme add '+this._name+' ['+this._name+'] [project]');
        }
        componentName = args._[2];
        project = args._[3];
        // Add the project to the package.json
        var pkgProject = utils.getPackageName(project);
        this._logger.info(
            'Adding '+componentName+' from '+pkgProject);

        // Add the component to the webgme config component paths
        // FIXME: Call this without --save then later save it
        job = spawn('npm', ['install', project, '--save'],
            {cwd: projectRoot}); 

        this._logger.info('npm install '+project+' --save');
        this._logger.infoStream(job.stdout);
        this._logger.infoStream(job.stderr);

        job.on('close', function(code) {
            this._logger.info('npm exited with: '+code);
            if (code === 0) {  // Success!
                // Look up the componentPath by trying to load the config of 
                // the new project or find the component through the component 
                // paths defined in the config.js
                var otherConfig,
                    componentPath = null,
                    config = utils.getConfig(),
                    gmeCliConfigPath = utils.getConfigPath(pkgProject.toLowerCase()),
                    gmeConfigPath = utils.getGMEConfigPath(pkgProject.toLowerCase()),
                    dependencyRoot = path.dirname(gmeConfigPath);

                if (fs.existsSync(gmeCliConfigPath)) {
                    otherConfig = JSON.parse(fs.readFileSync(gmeCliConfigPath, 'utf-8'));
                    if (otherConfig.components[this._group][componentName]) {
                        componentPath = otherConfig.components[this._group][componentName].src;
                    }
                } else if (fs.existsSync(gmeConfigPath)) {
                    otherConfig = nodeRequire(gmeConfigPath);
                    componentPath = utils.getPathContaining(otherConfig[this._webgmeName].basePaths.map(
                    function(p) {
                        if (!path.isAbsolute(p)) {
                            return path.join(path.dirname(gmeConfigPath), p);
                        }
                        return p;
                    }
                    ), componentName);
                    componentPath = componentPath !== null ? 
                        path.join(componentPath,componentName) : null;
                } else {
                    this._logger.error('Did not recognize the project as a WebGME project');
                }

                // Verify that the component exists in the project
                if (!componentPath) {
                    this._logger.error(pkgProject+' does not contain '+componentName);
                    return callback(pkgProject+' does not contain '+componentName);
                }
                if (!path.isAbsolute(componentPath)) {
                    componentPath = path.join(dependencyRoot, componentPath);
                }
                // If componentPath is not a directory, take the containing directory
                if (!fs.lstatSync(componentPath).isDirectory()) {
                    componentPath = path.dirname(componentPath);
                }

                componentPath = path.relative(projectRoot, componentPath);

                config.dependencies[this._group][componentName] = {
                    project: pkgProject,
                    path: componentPath
                };
                utils.saveConfig(config);

                // Update the webgme config file from 
                // the cli's config
                utils.updateWebGMEConfig();
                callback();

            } else {
                this._logger.error('Could not find project!');
            }
        }.bind(this));
    };

    ComponentManager.prototype._removeFromConfig = function(plugin, type) {
        var config = utils.getConfig();
        // Remove entry from the config
        delete config[type][this._group][plugin];
        utils.saveConfig(config);
        utils.updateWebGMEConfig();

        this._logger.write('Removed the '+plugin+'!');
    };

    /**
     * Get a resource from component's directory (ie, src/res/[name]).
     *
     * @param {String} name
     * @return {String}
     */
    ComponentManager.prototype._getResource = function(name) {
        var resourcePath = path.join(__dirname,'..','res',this._group,name);
        return fs.readFileSync(resourcePath, 'utf-8');
    };

    ComponentManager.prototype._getSaveLocation = function(type) {
        // Guarantee that it is either 'src' or 'test'
        type = type === 'test' ? 'test': 'src';
        var savePath = path.join(utils.getRootPath(), type, this._group);
        // We assume this means the location is relevant and will create
        // it if needed
        utils.mkdir(savePath);
        return savePath;
    };

    /**
     * Save a file to src/<type>/<name>/<name>.js
     *
     * @param {Object} opts
     * @return {undefined}
     */
    ComponentManager.prototype._saveFile = function(opts) {
        var type = opts.type || 'src',
            name = opts.name,
            filePath = path.join(this._getSaveLocation(type),name,name+'.js');
        if (fs.existsSync(filePath)) {
            return this._logger.error(filePath+' already exists');
        }
        // Create the directories
        utils.saveFile({name: filePath, content: opts.content});
        return path.relative(utils.getRootPath(), filePath);
    };

    /**
     * Add the names for components and dependencies
     * for this given component type
     *
     * @return {undefined}
     */
    ComponentManager.prototype._prepareWebGmeConfig = function() {
        // Check for project directory
        var projectHome = utils.getRootPath();
        if (projectHome !== null) {
            // Check for plugins entry in .webgme
            var config = utils.getConfig();
            var entries = Object.keys(config);
            entries.forEach(function(entry) {
                if (config[entry][this._group] === undefined) {
                    config[entry][this._group] = {};
                }
            }, this);
            utils.saveConfig(config);
        }
    };

    /**
     * Register the given component in the webgme-setup-tool config
     *
     * @param {String} name
     * @param {Object} content
     * @return {undefined}
     */
    ComponentManager.prototype._register = function(name, content) {
        var config = utils.getConfig();
        config.components[this._group][name] = content;
        utils.saveConfig(config);
        utils.updateWebGMEConfig();
    };

    return ComponentManager;
});
