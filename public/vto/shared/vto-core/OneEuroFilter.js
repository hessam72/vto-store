/**
 * One Euro Filter
 * Adaptive low-pass filter: low cutoff when slow (kills jitter),
 * high cutoff when fast (kills lag). Replaces fixed-alpha smoothing,
 * which forces a jitter-vs-lag tradeoff that cannot be won.
 *
 * fc = minCutoff + beta * |dx/dt|
 * Since all inputs here are metric (metres), beta is in Hz per m/s.
 */

import * as THREE from 'three';

const TAU = 2 * Math.PI;

function smoothingFactor(dt, cutoff) {
  const r = TAU * cutoff * dt;
  return r / (r + 1);
}

export class OneEuroFilter {
  /**
   * @param {number} minCutoff - Baseline cutoff in Hz. Lower = smoother when still.
   * @param {number} beta - Speed coefficient. Higher = less lag when moving fast.
   * @param {number} dCutoff - Cutoff for the derivative estimate, in Hz.
   */
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }

  /**
   * @param {number} x - New sample.
   * @param {number} timestampMs - Monotonic timestamp in ms.
   * @returns {number} Filtered value.
   */
  filter(x, timestampMs) {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = timestampMs;
      return x;
    }

    // Guard against a zero/negative dt (duplicate frame) blowing up the derivative.
    const dt = Math.max((timestampMs - this.tPrev) / 1000, 1e-3);
    this.tPrev = timestampMs;

    const dx = (x - this.xPrev) / dt;
    const aD = smoothingFactor(dt, this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingFactor(dt, cutoff);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  setParams(minCutoff, beta, dCutoff = this.dCutoff) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }
}

/**
 * One Euro applied per-component to a THREE.Vector3.
 */
export class Vector3Filter {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.x = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.y = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.z = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.out = new THREE.Vector3();
  }

  filter(v, timestampMs) {
    this.out.set(
      this.x.filter(v.x, timestampMs),
      this.y.filter(v.y, timestampMs),
      this.z.filter(v.z, timestampMs)
    );
    return this.out;
  }

  setParams(minCutoff, beta, dCutoff) {
    this.x.setParams(minCutoff, beta, dCutoff);
    this.y.setParams(minCutoff, beta, dCutoff);
    this.z.setParams(minCutoff, beta, dCutoff);
  }

  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }
}

/**
 * Rotation smoother: slerp with a speed-adaptive alpha, using the same
 * "slow = smooth, fast = responsive" law as the One Euro filter.
 * Component-wise filtering of a quaternion is not valid, so the adaptation
 * is driven by the angular distance between frames instead.
 */
export class QuaternionFilter {
  constructor(minCutoff = 1.5, beta = 0.35, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.current = new THREE.Quaternion();
    this.speedFilter = new OneEuroFilter(dCutoff, 0, dCutoff);
    this.initialized = false;
    this.tPrev = 0;
  }

  /**
   * @param {THREE.Quaternion} q - Target rotation.
   * @param {number} timestampMs
   * @returns {THREE.Quaternion} Smoothed rotation (internal instance, clone before storing).
   */
  filter(q, timestampMs) {
    if (!this.initialized) {
      this.current.copy(q);
      this.initialized = true;
      this.tPrev = timestampMs;
      return this.current;
    }

    const dt = Math.max((timestampMs - this.tPrev) / 1000, 1e-3);
    this.tPrev = timestampMs;

    // Keep the target on the same hemisphere, otherwise slerp takes the long way.
    if (this.current.dot(q) < 0) {
      q.set(-q.x, -q.y, -q.z, -q.w);
    }

    const angle = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(this.current.dot(q)), -1, 1));
    const angularSpeed = this.speedFilter.filter(angle / dt, timestampMs);

    const cutoff = this.minCutoff + this.beta * angularSpeed;
    const alpha = smoothingFactor(dt, cutoff);

    this.current.slerp(q, alpha);
    return this.current;
  }

  setParams(minCutoff, beta) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  reset() {
    this.initialized = false;
    this.current.identity();
    this.speedFilter.reset();
  }
}
