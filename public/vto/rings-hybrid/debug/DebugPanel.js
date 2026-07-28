/**
 * Debug Control Panel
 * Live parameter adjustment for ring positioning
 */

import GUI from 'lil-gui';

export class DebugPanel {
  constructor(config) {
    this.config = config;
    this.gui = new GUI({ title: 'Ring VTO Debug Panel', width: 320 });
    this.gui.close(); // Start closed

    // Debug parameters (reactive)
    this.params = {
      // Coordinate System
      mirrorX: true,
      invertY: true,
      invertZ: true,
      offsetX: 0.5,
      offsetY: 0.5,
      offsetZ: 0,
      globalScale: 5.0,
      depthMultiplier: 1.0,

      // Ring Positioning
      landmarkAnchor: 13,
      modelOffsetX: 0,
      modelOffsetY: 0,
      modelOffsetZ: 0,
      modelQuatX: 0,
      modelQuatY: 0,
      modelQuatZ: 0.707,
      modelQuatW: 0.707,
      modelScale: 1,

      // Camera
      cameraZ: 20,
      cameraFOV: 63,

      // Smoothing
      positionSmoothing: 0.65,
      rotationSmoothing: 0.45,

      // Actions
      reset: () => this.reset(),
      save: () => this.save(),
      load: () => this.load(),
      export: () => this.export()
    };

    this.setupGUI();
    this.loadFromLocalStorage();
  }

  setupGUI() {
    // Coordinate System folder
    const coordFolder = this.gui.addFolder('Coordinate System');
    coordFolder.add(this.params, 'mirrorX').name('Mirror X').onChange(() => this.onChange());
    coordFolder.add(this.params, 'invertY').name('Invert Y').onChange(() => this.onChange());
    coordFolder.add(this.params, 'invertZ').name('Invert Z').onChange(() => this.onChange());
    coordFolder.add(this.params, 'offsetX').name('Offset X').onChange(() => this.onChange());
    coordFolder.add(this.params, 'offsetY').name('Offset Y').onChange(() => this.onChange());
    coordFolder.add(this.params, 'offsetZ').name('Offset Z').onChange(() => this.onChange());
    coordFolder.add(this.params, 'globalScale').name('Global Scale').onChange(() => this.onChange());
    coordFolder.add(this.params, 'depthMultiplier').name('Depth Multiplier').onChange(() => this.onChange());

    // Ring Positioning folder
    const ringFolder = this.gui.addFolder('Ring Positioning');
    ringFolder.add(this.params, 'landmarkAnchor', 0, 20, 1).name('Landmark Anchor').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelOffsetX').name('Model Offset X').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelOffsetY').name('Model Offset Y').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelOffsetZ').name('Model Offset Z').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelQuatX').name('Quat X').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelQuatY').name('Quat Y').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelQuatZ').name('Quat Z').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelQuatW').name('Quat W').onChange(() => this.onChange());
    ringFolder.add(this.params, 'modelScale').name('Model Scale').onChange(() => this.onChange());

    // Camera folder
    const cameraFolder = this.gui.addFolder('Camera');
    cameraFolder.add(this.params, 'cameraZ').name('Camera Z').onChange(() => this.onChange());
    cameraFolder.add(this.params, 'cameraFOV').name('FOV').onChange(() => this.onChange());

    // Smoothing folder
    const smoothingFolder = this.gui.addFolder('Smoothing');
    smoothingFolder.add(this.params, 'positionSmoothing', 0, 1, 0.01).name('Position Alpha').onChange(() => this.onChange());
    smoothingFolder.add(this.params, 'rotationSmoothing', 0, 1, 0.01).name('Rotation Alpha').onChange(() => this.onChange());

    // Actions
    this.gui.add(this.params, 'reset').name('🔄 Reset to Defaults');
    this.gui.add(this.params, 'save').name('💾 Save Preset');
    this.gui.add(this.params, 'load').name('📂 Load Preset');
    this.gui.add(this.params, 'export').name('📋 Export JSON');
  }

  onChange() {
    // Auto-save to localStorage on any change
    this.saveToLocalStorage();

    // Notify config update (will be used by other components)
    if (this.onUpdate) {
      this.onUpdate(this.params);
    }
  }

  reset() {
    // Reset to default values
    this.params.mirrorX = true;
    this.params.invertY = true;
    this.params.invertZ = true;
    this.params.offsetX = 0.5;
    this.params.offsetY = 0.5;
    this.params.offsetZ = 0;
    this.params.globalScale = 5.0;
    this.params.depthMultiplier = 1.0;
    this.params.landmarkAnchor = 13;
    this.params.modelOffsetX = 0;
    this.params.modelOffsetY = 0;
    this.params.modelOffsetZ = 0;
    this.params.modelQuatX = 0;
    this.params.modelQuatY = 0;
    this.params.modelQuatZ = 0.707;
    this.params.modelQuatW = 0.707;
    this.params.modelScale = 1;
    this.params.cameraZ = 20;
    this.params.cameraFOV = 63;
    this.params.positionSmoothing = 0.65;
    this.params.rotationSmoothing = 0.45;

    this.gui.destroy();
    this.gui = new GUI({ title: 'Ring VTO Debug Panel', width: 320 });
    this.setupGUI();
    this.onChange();

    console.log('✅ Reset to default values');
  }

  save() {
    this.saveToLocalStorage();
    console.log('✅ Preset saved to localStorage');
    alert('Preset saved!');
  }

  load() {
    this.loadFromLocalStorage();
    console.log('✅ Preset loaded from localStorage');
    alert('Preset loaded!');
  }

  export() {
    const json = JSON.stringify(this.params, (key, value) => {
      // Skip function values
      if (typeof value === 'function') return undefined;
      return value;
    }, 2);

    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
      console.log('📋 Config exported to clipboard:\n', json);
      alert('Config copied to clipboard!');
    });
  }

  saveToLocalStorage() {
    const data = {};
    for (const key in this.params) {
      if (typeof this.params[key] !== 'function') {
        data[key] = this.params[key];
      }
    }
    localStorage.setItem('ring-vto-debug-params', JSON.stringify(data));
  }

  loadFromLocalStorage() {
    const saved = localStorage.getItem('ring-vto-debug-params');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.assign(this.params, data);
        console.log('📂 Loaded params from localStorage:', data);

        // Refresh GUI with loaded values
        this.gui.destroy();
        this.gui = new GUI({ title: 'Ring VTO Debug Panel', width: 320 });
        this.setupGUI();
      } catch (e) {
        console.warn('Failed to load params from localStorage:', e);
      }
    }
  }

  toggle() {
    if (this.gui._hidden) {
      this.gui.show();
    } else {
      this.gui.hide();
    }
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
