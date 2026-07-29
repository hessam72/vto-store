/**
 * Wrist VTO — entry point for watches and bracelets.
 *
 * Everything generic lives in ../shared/vto-core. This file supplies only the
 * forearm anatomy and the wrist-specific debug controls.
 */

import { resolveConfig } from './config.js';
import { WristAnchor } from './core/WristAnchor.js';
import { startVTO } from '../shared/vto-core/bootstrap.js';

const { config, product } = resolveConfig();
const isAbsolute = config.product.sizing.mode === 'absolute';

// The sizing control differs by product, because the two modes are genuinely
// different quantities: a watch case is an absolute millimetre spec, a bracelet
// bore is a multiple of the measured wrist.
const sizingControl = isAbsolute
  ? { folder: 'Fit', key: 'absoluteDiameterMm', args: [28, 60, 0.5], name: 'Case diameter (mm)' }
  : { folder: 'Fit', key: 'boreDiameterRatio', args: [0.8, 2.0, 0.01], name: 'Bore / wrist width' };

startVTO({
  label: `${product === 'bracelet' ? 'Bracelet' : 'Watch'} VTO`,
  config,
  anchor: new WristAnchor(config.anchor),
  panel: {
    title: `${product === 'bracelet' ? 'Bracelet' : 'Watch'} VTO Debug`,
    // Namespaced per product, so watch and bracelet presets do not overwrite
    // each other in localStorage.
    storageKey: `wrist-vto-debug-params-${product}-v1`,
    defaults: {
      boreAxis: config.product.boreAxis,
      anchorOffsetMm: config.anchor.anchorOffsetMm,
      wristWidthCoeff: config.anchor.wristWidthCoeff,
      wristDepthRatio: config.anchor.wristDepthRatio,
      ...(isAbsolute
        ? { absoluteDiameterMm: config.product.sizing.diameterMm }
        : { boreDiameterRatio: config.product.sizing.boreDiameterRatio })
    },
    extra: [
      {
        folder: 'Fit',
        key: 'anchorOffsetMm',
        args: [0, 90, 1],
        name: 'Up the forearm (mm)'
      },
      {
        folder: 'Fit',
        key: 'wristWidthCoeff',
        args: [0.4, 1.0, 0.01],
        name: 'Wrist width calib.'
      },
      {
        folder: 'Fit',
        key: 'wristDepthRatio',
        args: [0.4, 1.0, 0.01],
        name: 'Wrist depth / width'
      },
      sizingControl
    ],
    readouts: [
      { key: 'depthCm', name: 'Depth (cm)', format: (t) => (t.depth * 100).toFixed(1) },
      { key: 'wristWidthMm', name: 'Wrist width (mm)', format: (t) => (t.width * 1000).toFixed(1) },
      // Must exceed the wrist width, or the product is inside the arm and the
      // occluder hides it. This is the number that reflects the model — the
      // fitted HOLE is wristWidth x ratio by algebra and cannot reveal anything.
      ...(isAbsolute ? [] : [{
        key: 'fittedOuterMm',
        name: 'Fitted outer (mm)',
        format: (t) => (t.fittedOuterM * 1000).toFixed(1) +
          // Say so when a hand override is in play, or the next puzzling
          // size becomes a hunt for a bug that is really a saved slider.
          (t.scaleMultiplier === 1 ? '' : ` (x${t.scaleMultiplier})`)
      }]),
      { key: 'handedness', name: 'Hand', format: (t) => t.handedness }
    ]
  }
});
