/**
 * Debug Control Panel
 *
 * The old panel exposed `globalScale` and `depthMultiplier`, which set depth and
 * world scale at the same time — tuning one always broke the other. Those are
 * gone. What is left are parameters that each do exactly one thing, in real
 * units, plus a readout of what the solver actually computed.
 */

import GUI from 'lil-gui';

// Bumped so browsers holding the old coupled parameters do not restore them.
const STORAGE_KEY = 'ring-vto-debug-params-v2';

const DEFAULTS = {
  // Camera model
  vFOV: 60,
  mirror: true,
  flipHandedness: false,

  // Ring placement
  anchorAlongPhalanx: 0.45,
  ringOffsetXMm: 0,
  ringOffsetYMm: 0,
  ringOffsetZMm: 0,
  modelQuatX: 0,
  modelQuatY: 0,
  modelQuatZ: 0,
  modelQuatW: 1,

  // Fit
  fingerWidthCoeff: 0.72,
  outerDiameterRatio: 1.25,

  // Smoothing (One Euro: cutoff in Hz, beta is the speed coefficient)
  positionMinCutoff: 1.0,
  positionBeta: 0.007,
  rotationMinCutoff: 1.5,
  rotationBeta: 0.35,

  showMarker: true
};

export class DebugPanel {
  constructor(config) {
    this.config = config;
    this.params = { ...DEFAULTS, ...this.readStorage() };

    // Live solver output, displayed read-only.
    this.readout = {
      depthCm: 0,
      fingerWidthMm: 0,
      handedness: '-'
    };

    this.buildGUI();
  }

  buildGUI() {
    this.gui = new GUI({ title: 'Ring VTO Debug', width: 320 });
    this.gui.close();

    const solved = this.gui.addFolder('Solved (read-only)');
    this.readoutControllers = [
      solved.add(this.readout, 'depthCm').name('Depth (cm)').disable(),
      solved.add(this.readout, 'fingerWidthMm').name('Finger width (mm)').disable(),
      solved.add(this.readout, 'handedness').name('Hand').disable()
    ];
    solved.open();

    const camera = this.gui.addFolder('Camera model');
    this.add(camera, 'vFOV', 30, 90, 1).name('Vertical FOV (deg)');
    this.add(camera, 'mirror').name('Mirror (selfie)');
    this.add(camera, 'flipHandedness').name('Flip handedness');

    const ring = this.gui.addFolder('Ring placement');
    this.add(ring, 'anchorAlongPhalanx', 0, 1, 0.01).name('Along phalanx (0=MCP)');
    this.add(ring, 'ringOffsetXMm', -20, 20, 0.5).name('Offset across (mm)');
    this.add(ring, 'ringOffsetYMm', -20, 20, 0.5).name('Offset along (mm)');
    this.add(ring, 'ringOffsetZMm', -20, 20, 0.5).name('Offset out of palm (mm)');
    this.add(ring, 'modelQuatX', -1, 1, 0.001).name('Model quat X');
    this.add(ring, 'modelQuatY', -1, 1, 0.001).name('Model quat Y');
    this.add(ring, 'modelQuatZ', -1, 1, 0.001).name('Model quat Z');
    this.add(ring, 'modelQuatW', -1, 1, 0.001).name('Model quat W');

    const fit = this.gui.addFolder('Fit');
    this.add(fit, 'fingerWidthCoeff', 0.4, 1.2, 0.01).name('Finger width calib.');
    this.add(fit, 'outerDiameterRatio', 0.8, 2.0, 0.01).name('Ring / finger width');

    const smoothing = this.gui.addFolder('Smoothing (One Euro)');
    this.add(smoothing, 'positionMinCutoff', 0.1, 10, 0.1).name('Pos min cutoff (Hz)');
    this.add(smoothing, 'positionBeta', 0, 0.1, 0.001).name('Pos beta');
    this.add(smoothing, 'rotationMinCutoff', 0.1, 10, 0.1).name('Rot min cutoff (Hz)');
    this.add(smoothing, 'rotationBeta', 0, 2, 0.01).name('Rot beta');

    const view = this.gui.addFolder('View');
    this.add(view, 'showMarker').name('Anchor marker');

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
   * Show what the solver produced this frame. This is the panel's real job now:
   * confirming the metric solve is sane rather than offering knobs to guess with.
   */
  setReadout(transform) {
    if (!transform?.visible) return;
    this.readout.depthCm = Number((transform.depth * 100).toFixed(1));
    this.readout.fingerWidthMm = Number((transform.fingerWidth * 1000).toFixed(1));
    this.readout.handedness = transform.handedness;
    this.readoutControllers.forEach((controller) => controller.updateDisplay());
  }

  reset() {
    Object.assign(this.params, DEFAULTS);
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return {};
      // Only keep keys that still exist, so a stale entry cannot reintroduce a
      // parameter that no longer means anything.
      const parsed = JSON.parse(saved);
      return Object.fromEntries(
        Object.entries(parsed).filter(([key]) => key in DEFAULTS)
      );
    } catch (error) {
      console.warn('Failed to read debug params from localStorage:', error);
      return {};
    }
  }

  writeStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.params));
  }

  toggle() {
    if (this.gui._hidden) this.gui.show();
    else this.gui.hide();
  }

  show() {
    this.gui.show();
  }

  hide() {
    this.gui.hide();
  }

  destroy() {
    this.gui.destroy();
  }
}
