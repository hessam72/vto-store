/**
 * Debug Control Panel.
 *
 * Every parameter here does exactly one thing, in real units. There is
 * deliberately no "global scale" or "depth multiplier": those two were coupled —
 * depth and world scale moved together — so no combination of them was ever
 * correct. Scale now comes from the measured anatomy or an absolute product
 * dimension, and the panel's main job is the solved readout that confirms it.
 *
 * Apps extend it with their own fields via the `extra` schema.
 */

import GUI from 'lil-gui';

// Bump whenever a parameter's MEANING changes, even if its name does not, or
// whenever a shipped DEFAULT changes — a saved preset silently outranks a new
// default, so the config edit looks like it did nothing. Saved presets from an
// older schema are discarded rather than reinterpreted.
const SCHEMA_VERSION = 3;

export const COMMON_DEFAULTS = {
  // Camera model
  vFOV: 60,
  mirror: true,
  flipHandedness: false,

  // Orientation
  boreAxis: 'auto',
  rollDeg: 0,

  // Fine placement, in the product's local frame
  offsetXMm: 0,
  offsetYMm: 0,
  offsetZMm: 0,

  // Smoothing (One Euro: cutoff in Hz, beta is the speed coefficient)
  positionMinCutoff: 1.0,
  positionBeta: 0.007,
  rotationMinCutoff: 1.5,
  rotationBeta: 0.35,

  // Manual size override; 1.0 means "use the measured fit".
  scaleMultiplier: 1.0,

  showMarker: true,
  showOccluder: false
};

export class DebugPanel {
  /**
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.storageKey - Namespaced per app so presets do not collide.
   * @param {Object} options.defaults - COMMON_DEFAULTS merged with the app's own.
   * @param {Array}  options.extra - [{ folder, key, args, name }] app-specific controls.
   * @param {Array}  options.readouts - [{ key, name, format }] solved values to display.
   */
  constructor(options) {
    this.options = options;
    this.defaults = { ...COMMON_DEFAULTS, ...(options.defaults || {}) };
    this.params = { ...this.defaults, ...this.readStorage() };

    this.readout = {};
    for (const r of options.readouts || []) this.readout[r.key] = '-';

    this.buildGUI();
  }

  buildGUI() {
    this.gui = new GUI({ title: this.options.title, width: 320 });
    this.gui.close();

    const solved = this.gui.addFolder('Solved (read-only)');
    this.readoutControllers = (this.options.readouts || []).map(
      (r) => solved.add(this.readout, r.key).name(r.name).disable()
    );
    solved.open();

    const camera = this.gui.addFolder('Camera model');
    this.add(camera, 'vFOV', 30, 90, 1).name('Vertical FOV (deg)');
    this.add(camera, 'mirror').name('Mirror (selfie)');
    this.add(camera, 'flipHandedness').name('Flip handedness');

    const placement = this.gui.addFolder('Placement');
    // Orientation as two things a human can reason about, rather than four
    // coupled quaternion components that have to stay normalized.
    this.add(placement, 'boreAxis', ['auto', 'x', 'y', 'z']).name('GLB bore axis');
    this.add(placement, 'rollDeg', 0, 360, 1).name('Roll about limb (deg)');
    this.add(placement, 'offsetXMm', -40, 40, 0.5).name('Offset across (mm)');
    this.add(placement, 'offsetYMm', -40, 40, 0.5).name('Offset along (mm)');
    this.add(placement, 'offsetZMm', -40, 40, 0.5).name('Offset out of skin (mm)');

    // App-specific controls (fit calibration, absolute size, anchor offset, ...).
    const folders = new Map();
    for (const control of this.options.extra || []) {
      if (!folders.has(control.folder)) {
        folders.set(control.folder, this.gui.addFolder(control.folder));
      }
      this.add(folders.get(control.folder), control.key, ...(control.args || []))
        .name(control.name);
    }

    // Wide range on purpose: the reason to reach for this is that something is
    // badly off. The physical parameters above stay narrow.
    this.add(placement, 'scaleMultiplier', 0.25, 4, 0.01).name('Scale multiplier');

    const smoothing = this.gui.addFolder('Smoothing (One Euro)');
    this.add(smoothing, 'positionMinCutoff', 0.1, 10, 0.1).name('Pos min cutoff (Hz)');
    this.add(smoothing, 'positionBeta', 0, 0.1, 0.001).name('Pos beta');
    this.add(smoothing, 'rotationMinCutoff', 0.1, 10, 0.1).name('Rot min cutoff (Hz)');
    this.add(smoothing, 'rotationBeta', 0, 2, 0.01).name('Rot beta');

    const view = this.gui.addFolder('View');
    this.add(view, 'showMarker').name('Anchor marker');
    // Renders the occluder as a wireframe limb, so a bad fit is visible
    // rather than just a product that mysteriously vanished.
    this.add(view, 'showOccluder').name('Show occluder (limb)');

    this.gui.add({ reset: () => this.reset() }, 'reset').name('Reset to defaults');
    this.gui.add({ copy: () => this.copy() }, 'copy').name('Copy config JSON');
  }

  add(folder, key, ...range) {
    return folder.add(this.params, key, ...range).onChange(() => this.onChange());
  }

  onChange() {
    this.writeStorage();
    this.onUpdate?.(this.params);
  }

  /**
   * Show what the solver produced this frame. This is the panel's real job:
   * confirming the metric solve is sane rather than offering knobs to guess with.
   */
  setReadout(transform) {
    if (!transform?.visible) return;
    for (const r of this.options.readouts || []) {
      this.readout[r.key] = r.format(transform);
    }
    this.readoutControllers.forEach((controller) => controller.updateDisplay());
  }

  reset() {
    Object.assign(this.params, this.defaults);
    this.gui.destroy();
    this.buildGUI();
    this.onChange();
    console.log('Debug params reset to defaults');
  }

  copy() {
    const json = JSON.stringify(this.params, null, 2);
    navigator.clipboard?.writeText(json);
    console.log('Config:\n', json);
  }

  readStorage() {
    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (!saved) return {};
      const parsed = JSON.parse(saved);

      // Filtering by key presence is not enough. `boreDiameterRatio` kept its
      // name while its meaning changed from "multiplier on the outer diameter"
      // to "clearance on the hole", and a saved 1.15 then silently overrode the
      // new default — the config change appeared to do nothing. Version the
      // payload so changing what a parameter MEANS invalidates old presets, not
      // just adding or removing one.
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        console.warn(
          `Discarding saved debug params (schema ${parsed.schemaVersion ?? 'none'} ` +
          `!= ${SCHEMA_VERSION}); parameter meanings have changed.`
        );
        localStorage.removeItem(this.options.storageKey);
        return {};
      }

      // Still drop keys that no longer exist at all.
      return Object.fromEntries(
        Object.entries(parsed).filter(([key]) => key in this.defaults)
      );
    } catch (error) {
      console.warn('Failed to read debug params from localStorage:', error);
      return {};
    }
  }

  writeStorage() {
    localStorage.setItem(
      this.options.storageKey,
      JSON.stringify({ ...this.params, schemaVersion: SCHEMA_VERSION })
    );
  }

  toggle() {
    if (this.gui._hidden) this.gui.show();
    else this.gui.hide();
  }

  show() { this.gui.show(); }
  hide() { this.gui.hide(); }
  destroy() { this.gui.destroy(); }
}
