/**
 * @module PluginSystem
 * Minimal plugin architecture for extending the flow editor.
 *
 * A plugin is a plain object with an `install(editor)` method.
 */

export class PluginSystem {
  /**
   * @param {Object} editor - The FlowEditor instance
   */
  constructor(editor) {
    this._editor = editor;
    /** @type {Map<string, Object>} */
    this._plugins = new Map();
  }

  /**
   * Install a plugin.
   * @param {string} name
   * @param {{ install: (editor: Object) => void, [key: string]: any }} plugin
   */
  use(name, plugin) {
    if (this._plugins.has(name)) {
      console.warn(`[jsFlow] Plugin "${name}" is already installed.`);
      return;
    }
    plugin.install(this._editor);
    this._plugins.set(name, plugin);
  }

  /**
   * Check if a plugin is installed.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._plugins.has(name);
  }

  /**
   * Get an installed plugin instance.
   * @param {string} name
   * @returns {Object|undefined}
   */
  get(name) {
    return this._plugins.get(name);
  }
}
