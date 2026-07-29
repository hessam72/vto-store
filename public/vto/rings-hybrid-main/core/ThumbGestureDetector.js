/**
 * Thumb Gesture Detector
 *
 * Turns MediaPipe's canned gesture classifier into two product-switch events:
 *
 *   IDLE → THUMB_UP_HOLDING   → (held) → 'next'     → COOLDOWN → IDLE
 *   IDLE → THUMB_DOWN_HOLDING → (held) → 'previous' → COOLDOWN → IDLE
 *
 * Only the thumbs are bound. Closed_Fist and Open_Palm — which the sibling
 * gesture-detector demo also uses — are the poses a hand passes through while a
 * ring is being turned and inspected, so binding them here would switch the
 * product constantly. The hold requirement covers the rest: a thumb caught in
 * passing does not commit.
 *
 * Direction is explicit per gesture, so nothing here depends on where the hand
 * is on screen and the mirrored video needs no compensation.
 */

const STATES = {
  IDLE: 'IDLE',
  THUMB_UP_HOLDING: 'THUMB_UP_HOLDING',
  THUMB_DOWN_HOLDING: 'THUMB_DOWN_HOLDING',
  COOLDOWN: 'COOLDOWN'
};

const NO_GESTURE = { category: 'None', confidence: 0 };

export class ThumbGestureDetector {
  constructor(config = {}) {
    this.config = {
      minConfidence: 0.7,
      thumbHoldDurationMs: 1500,
      cooldownMs: 1000,
      ...config
    };

    this.states = STATES;
    this.currentState = STATES.IDLE;
    this.thumbDetectedTime = null;
    this.cooldownTimeout = null;

    // Set by the caller: returning true from canTrigger() gates the swap, so a
    // gesture cannot fire while a model is still loading.
    this.onSwapTriggered = null;
    this.onStateChange = null;
    this.canTrigger = null;
  }

  /**
   * @param {Object} results - Raw MediaPipe GestureRecognizerResult.
   * @returns {Object} { state, gesture, timeRemaining, progress }
   */
  process(results) {
    const gesture = getDominantGesture(results?.gestures?.[0]);
    this.updateStateMachine(gesture);

    return {
      state: this.currentState,
      gesture,
      timeRemaining: this.getTimeRemaining(),
      progress: this.getHoldProgress()
    };
  }

  updateStateMachine(gesture) {
    const { category, confidence } = gesture;
    const now = performance.now();
    const isValidGesture = confidence >= this.config.minConfidence;

    switch (this.currentState) {
      case STATES.IDLE:
        if (!isValidGesture) break;
        if (category === 'Thumb_Up') {
          this.transitionTo(STATES.THUMB_UP_HOLDING);
          this.thumbDetectedTime = now;
        } else if (category === 'Thumb_Down') {
          this.transitionTo(STATES.THUMB_DOWN_HOLDING);
          this.thumbDetectedTime = now;
        }
        break;

      case STATES.THUMB_UP_HOLDING:
        this.updateHold(gesture, now, 'Thumb_Up', 'next');
        break;

      case STATES.THUMB_DOWN_HOLDING:
        this.updateHold(gesture, now, 'Thumb_Down', 'previous');
        break;

      case STATES.COOLDOWN:
        // Locked out until the timeout returns to IDLE.
        break;
    }
  }

  /**
   * One tick of a hold: commit once the dwell is met, abandon the moment the
   * gesture changes or its confidence drops.
   */
  updateHold(gesture, now, expectedCategory, direction) {
    const held = gesture.confidence >= this.config.minConfidence &&
      gesture.category === expectedCategory;

    if (!held) {
      this.transitionTo(STATES.IDLE);
      this.thumbDetectedTime = null;
      return;
    }

    if (now - this.thumbDetectedTime < this.config.thumbHoldDurationMs) return;

    // Held long enough. A caller that is busy (mid-load) keeps the hold alive
    // rather than swallowing the gesture, so the swap lands as soon as it can.
    if (this.canTrigger && !this.canTrigger()) return;

    console.log(`${direction === 'next' ? '👍' : '👎'} thumb held — ${direction}`);
    this.thumbDetectedTime = null;
    this.transitionTo(STATES.COOLDOWN);
    this.startCooldown();
    this.onSwapTriggered?.(direction);
  }

  startCooldown() {
    clearTimeout(this.cooldownTimeout);
    this.cooldownTimeout = setTimeout(() => {
      this.cooldownTimeout = null;
      this.transitionTo(STATES.IDLE);
    }, this.config.cooldownMs);
  }

  transitionTo(newState) {
    const oldState = this.currentState;
    if (oldState === newState) return;

    this.currentState = newState;
    this.onStateChange?.({ from: oldState, to: newState, timestamp: performance.now() });
  }

  /** Milliseconds left on the current hold, for the on-screen countdown. */
  getTimeRemaining() {
    if (!this.isHolding() || !this.thumbDetectedTime) return 0;
    const elapsed = performance.now() - this.thumbDetectedTime;
    return Math.max(0, this.config.thumbHoldDurationMs - elapsed);
  }

  /** Hold completion in 0..1, for the progress bar. */
  getHoldProgress() {
    if (!this.isHolding() || !this.thumbDetectedTime) return 0;
    const elapsed = performance.now() - this.thumbDetectedTime;
    return Math.min(1, elapsed / this.config.thumbHoldDurationMs);
  }

  isHolding() {
    return this.currentState === STATES.THUMB_UP_HOLDING ||
      this.currentState === STATES.THUMB_DOWN_HOLDING;
  }

  reset() {
    clearTimeout(this.cooldownTimeout);
    this.cooldownTimeout = null;
    this.currentState = STATES.IDLE;
    this.thumbDetectedTime = null;
  }

  destroy() {
    this.reset();
    this.onSwapTriggered = null;
    this.onStateChange = null;
    this.canTrigger = null;
  }
}

/**
 * Highest-scoring gesture for the first hand. MediaPipe reports categories
 * already sorted, but the sort makes that independent of the task's ordering.
 */
function getDominantGesture(handGestures) {
  if (!handGestures || handGestures.length === 0) return NO_GESTURE;

  let best = NO_GESTURE;
  for (const g of handGestures) {
    if (g.score > best.confidence) best = { category: g.categoryName, confidence: g.score };
  }
  return best;
}
