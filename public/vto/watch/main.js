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
      axisMinCutoff: config.anchor.axisMinCutoff,
      axisBeta: config.anchor.axisBeta,
      axisBlend: config.anchor.axisBlend,
      widthMedianFrames: config.anchor.widthMedianFrames,
      // Must be restated here. VTOScene reads `debugParams.scaleMultiplier ??
      // config...`, and the panel always carries COMMON_DEFAULTS' 1.0 — so
      // without this line the config value is permanently shadowed and setting
      // it appears to do nothing.
      scaleMultiplier: config.product.sizing.scaleMultiplier,
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
      // Median window on the raw wrist span. Raise it if the product's size
      // visibly breathes; it does not shift the average, so the width
      // calibration above is unaffected either way.
      {
        folder: 'Fit',
        key: 'widthMedianFrames',
        args: [1, 15, 1],
        name: 'Width median frames'
      },
      sizingControl,
      // Tilt damping, independent of the pose filter in Smoothing. Lower cutoff
      // = steadier through hand articulation, slower to follow a real arm turn.
      {
        folder: 'Axis smoothing',
        key: 'axisMinCutoff',
        args: [0.1, 4.0, 0.05],
        name: 'Forearm axis cutoff'
      },
      {
        folder: 'Axis smoothing',
        key: 'axisBeta',
        args: [0.0, 1.0, 0.01],
        name: 'Forearm axis beta'
      },
      // The A/B switch for the pose-derived forearm axis. 0 is the old
      // hand-only behaviour, 1 trusts the elbow->wrist vector. Slide it while
      // holding the wrist bent and the tilt should follow it directly, which is
      // the whole feature in one control.
      {
        folder: 'Forearm axis (pose)',
        key: 'axisBlend',
        args: [0.0, 1.0, 0.05],
        name: 'Pose axis blend'
      }
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
      { key: 'handedness', name: 'Hand', format: (t) => t.handedness },
      // The angle between the hand-extrapolated axis and the pose-derived one.
      // With the blend at 1 this is the error the hand-only rule WOULD have
      // made, read off a real arm rather than a synthetic hand — bend the wrist
      // and it should climb roughly 1:1 with the bend while the watch stays put.
      // "hand only" means no usable pose this frame and the fallback is live.
      {
        key: 'flexionErrorDeg',
        name: 'Flexion error (deg)',
        format: (t) => (t.axisDivergenceDeg == null
          ? 'hand only'
          : t.axisDivergenceDeg.toFixed(1))
      }
    ]
  }
});
