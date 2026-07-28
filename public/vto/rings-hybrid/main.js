/**
 * Ring VTO — entry point.
 *
 * Everything generic lives in ../shared/vto-core. This file supplies only the
 * finger anatomy and the ring-specific debug controls.
 */

import { RingConfig } from './config.js';
import { RingAnchor } from './core/RingAnchor.js';
import { startVTO } from '../shared/vto-core/bootstrap.js';

startVTO({
  label: 'Ring VTO',
  config: RingConfig,
  anchor: new RingAnchor(RingConfig.anchor),
  panel: {
    title: 'Ring VTO Debug',
    storageKey: 'ring-vto-debug-params-v3',
    defaults: {
      boreAxis: RingConfig.product.boreAxis,
      anchorAlongPhalanx: RingConfig.anchor.anchorAlongPhalanx,
      fingerWidthCoeff: RingConfig.anchor.fingerWidthCoeff,
      boreDiameterRatio: RingConfig.product.sizing.boreDiameterRatio
    },
    extra: [
      {
        folder: 'Fit',
        key: 'anchorAlongPhalanx',
        args: [0, 1, 0.01],
        name: 'Along phalanx (0=MCP)'
      },
      {
        folder: 'Fit',
        key: 'fingerWidthCoeff',
        args: [0.4, 1.2, 0.01],
        name: 'Finger width calib.'
      },
      {
        folder: 'Fit',
        key: 'boreDiameterRatio',
        args: [0.8, 2.0, 0.01],
        name: 'Ring / finger width'
      }
    ],
    readouts: [
      { key: 'depthCm', name: 'Depth (cm)', format: (t) => (t.depth * 100).toFixed(1) },
      { key: 'fingerWidthMm', name: 'Finger width (mm)', format: (t) => (t.width * 1000).toFixed(1) },
      { key: 'handedness', name: 'Hand', format: (t) => t.handedness }
    ]
  }
});
