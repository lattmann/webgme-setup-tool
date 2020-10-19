/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator from webgme on Wed Jul 29 2015 20:28:43 GMT-0500 (CDT).
 */

define(["plugin/PluginBase"], function (PluginBase) {
  "use strict";

  /**
   * Initializes a new instance of AddToPlugin.
   * @class
   * @augments {PluginBase}
   * @classdesc This class represents the plugin AddToPlugin.
   * @constructor
   */
  var AddToPlugin = function () {
    // Call base class' constructor.
    PluginBase.call(this);
    this.pluginMetadata = {
      name: "ComponentEnabler",
      version: "2.0.0",
      configStructure: [
        {
          name: "field",
          displayName: "Field",
          description: "Field of root node to add to",
          value: null,
          valueType: "string",
          readOnly: false,
        },
        {
          name: "attribute",
          displayName: "Attribute",
          description: "Attribute to add to field",
          value: "",
          valueType: "string",
          readOnly: false,
        },
      ],
    };
  };

  // Prototypal inheritance from PluginBase.
  AddToPlugin.prototype = Object.create(PluginBase.prototype);
  AddToPlugin.prototype.constructor = AddToPlugin;

  /**
   * Main function for the plugin to execute. This will perform the execution.
   * Notes:
   * - Always log with the provided logger.[error,warning,info,debug].
   * - Do NOT put any user interaction logic UI, etc. inside this method.
   * - callback always has to be called even if error happened.
   *
   * @param {function(string, plugin.PluginResult)} callback - the result callback
   */
  AddToPlugin.prototype.main = function (callback) {
    // Use self to access core, project, result, logger etc from PluginBase.
    // These are all instantiated at this point.
    var self = this,
      currentConfig = self.getCurrentConfig(),
      field = currentConfig.field,
      attribute = currentConfig.attribute,
      attributes;

    if (!currentConfig.field) {
      self.result.setSuccess(false);
      return callback("No field provided", self.result);
    }

    // Add to root node's "field" attribute
    attributes = (self.core.getRegistry(self.rootNode, field) || "").split(" ");
    if (attributes.indexOf(attribute) === -1) {
      attributes.push(attribute);
      self.logger.info("Setting " + field + " to " + attributes.join(" "));
    }
    self.core.setRegistry(this.rootNode, field, attributes.join(" "));

    // This will save the changes. If you don't want to save;
    // exclude self.save and call callback directly from this scope.
    self.result.setSuccess(true);
    self.save("Added " + attribute + " to " + field, function (err) {
      callback(null, self.result);
    });
  };

  return AddToPlugin;
});
