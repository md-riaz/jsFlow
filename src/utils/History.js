/**
 * @module History
 * Undo/redo stack using command pattern with state snapshots.
 */

import { EventEmitter } from './EventEmitter.js';

/**
 * @typedef {Object} Snapshot
 * @property {string} label - Human-readable action label
 * @property {*} state     - Serialised state at this point
 */

export class History extends EventEmitter {
  /**
   * @param {number} [maxSize=100]
   */
  constructor(maxSize = 100) {
    super();
    /** @type {Snapshot[]} */
    this._past = [];
    /** @type {Snapshot[]} */
    this._future = [];
    /** @type {number} */
    this._maxSize = maxSize;
    /** @type {boolean} */
    this._suspended = false;
  }

  /**
   * Push the current state snapshot onto the undo stack.
   * Clears the redo stack (new branch).
   * @param {string} label
   * @param {*} snapshot - A serialisable value representing the current state
   */
  push(label, snapshot) {
    if (this._suspended) return;
    this._past.push({ label, state: snapshot });
    if (this._past.length > this._maxSize) this._past.shift();
    this._future = [];
    this.emit('change', this.status());
  }

  /**
   * Undo the last action.
   * @returns {{ label: string, state: * } | null} the snapshot to restore, or null
   */
  undo() {
    if (!this.canUndo()) return null;
    const entry = this._past.pop();
    this._future.push(entry);
    this.emit('change', this.status());
    return this._past.length ? this._past[this._past.length - 1] : null;
  }

  /**
   * Redo the previously undone action.
   * @returns {{ label: string, state: * } | null}
   */
  redo() {
    if (!this.canRedo()) return null;
    const entry = this._future.pop();
    this._past.push(entry);
    this.emit('change', this.status());
    return entry;
  }

  /** @returns {boolean} */
  canUndo() {
    return this._past.length > 0;
  }

  /** @returns {boolean} */
  canRedo() {
    return this._future.length > 0;
  }

  /**
   * Temporarily disable recording — useful during restore.
   * @param {Function} fn
   */
  suspend(fn) {
    this._suspended = true;
    try { fn(); } finally { this._suspended = false; }
  }

  /** Clear all history */
  clear() {
    this._past = [];
    this._future = [];
    this.emit('change', this.status());
  }

  /**
   * @returns {{ canUndo: boolean, canRedo: boolean, undoLabel: string|null, redoLabel: string|null }}
   */
  status() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoLabel: this._past.length ? this._past[this._past.length - 1].label : null,
      redoLabel: this._future.length ? this._future[this._future.length - 1].label : null,
    };
  }
}
