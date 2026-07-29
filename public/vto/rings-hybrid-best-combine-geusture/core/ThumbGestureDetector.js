/**
 * Thumbs-Only Gesture Detector
 * State machine for detecting Thumb_Up (next) and Thumb_Down (previous)
 * Requires 1.5-second hold duration
 */

export class ThumbGestureDetector {
  constructor(config = {}) {
    this.config = {
      minConfidence: 0.7,
      thumbHoldDurationMs: 1500,
      cooldownMs: 1000,
      ...config
    };

    // State machine states
    this.states = {
      IDLE: 'IDLE',
      THUMB_UP_HOLDING: 'THUMB_UP_HOLDING',
      THUMB_DOWN_HOLDING: 'THUMB_DOWN_HOLDING',
      COOLDOWN: 'COOLDOWN'
    };

    this.currentState = this.states.IDLE;
    this.thumbDetectedTime = null;
    this.cooldownTimeout = null;

    // Event callbacks
    this.onSwapTriggered = null;
    this.onStateChange = null;
  }

  /**
   * Process gesture results from MediaPipe
   */
  process(results) {
    const { gestures } = results;

    // Extract dominant gesture
    const dominantGesture = this.getDominantGesture(gestures);

    // State machine logic
    this.updateStateMachine(dominantGesture);

    return {
      state: this.currentState,
      gesture: dominantGesture,
      timeRemaining: this.getTimeRemaining()
    };
  }

  /**
   * Get dominant gesture from results
   */
  getDominantGesture(gestures) {
    if (!gestures || gestures.length === 0) {
      return { category: 'None', confidence: 0 };
    }

    // Get gesture with highest confidence
    const sorted = [...gestures].sort((a, b) => b.confidence - a.confidence);
    return sorted[0];
  }

  /**
   * State machine update
   */
  updateStateMachine(gesture) {
    const { category, confidence } = gesture;
    const now = performance.now();

    // Check if gesture confidence meets threshold
    const isValidGesture = confidence >= this.config.minConfidence;

    switch (this.currentState) {
      case this.states.IDLE:
        if (isValidGesture && category === 'Thumb_Up') {
          this.transitionTo(this.states.THUMB_UP_HOLDING);
          this.thumbDetectedTime = now;
          console.log('👍 Thumb up detected - hold for 1.5s...');
        } else if (isValidGesture && category === 'Thumb_Down') {
          this.transitionTo(this.states.THUMB_DOWN_HOLDING);
          this.thumbDetectedTime = now;
          console.log('👎 Thumb down detected - hold for 1.5s...');
        }
        break;

      case this.states.THUMB_UP_HOLDING:
        const thumbUpElapsed = now - this.thumbDetectedTime;

        if (isValidGesture && category === 'Thumb_Up') {
          if (thumbUpElapsed >= this.config.thumbHoldDurationMs) {
            // Held long enough: trigger next
            console.log('👍 Thumb up held - NEXT!');
            this.triggerSwap('next');
            this.transitionTo(this.states.COOLDOWN);
            this.startCooldown();
            this.thumbDetectedTime = null;
          }
          // Continue holding
        } else {
          // Released too early or different gesture
          console.log('❌ Thumb up released too early');
          this.transitionTo(this.states.IDLE);
          this.thumbDetectedTime = null;
        }
        break;

      case this.states.THUMB_DOWN_HOLDING:
        const thumbDownElapsed = now - this.thumbDetectedTime;

        if (isValidGesture && category === 'Thumb_Down') {
          if (thumbDownElapsed >= this.config.thumbHoldDurationMs) {
            // Held long enough: trigger previous
            console.log('👎 Thumb down held - PREVIOUS!');
            this.triggerSwap('previous');
            this.transitionTo(this.states.COOLDOWN);
            this.startCooldown();
            this.thumbDetectedTime = null;
          }
          // Continue holding
        } else {
          // Released too early or different gesture
          console.log('❌ Thumb down released too early');
          this.transitionTo(this.states.IDLE);
          this.thumbDetectedTime = null;
        }
        break;

      case this.states.COOLDOWN:
        // Waiting for cooldown to expire (handled by timeout)
        break;
    }
  }

  /**
   * Trigger swap action
   */
  triggerSwap(direction) {
    console.log(`✋ Swap triggered! (${direction})`);
    if (this.onSwapTriggered) {
      this.onSwapTriggered(direction);
    }
  }

  /**
   * Start cooldown period
   */
  startCooldown() {
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
    }

    this.cooldownTimeout = setTimeout(() => {
      console.log('⏰ Cooldown expired - ready for next gesture');
      this.transitionTo(this.states.IDLE);
      this.thumbDetectedTime = null;
      this.cooldownTimeout = null;
    }, this.config.cooldownMs);
  }

  /**
   * Transition to new state
   */
  transitionTo(newState) {
    const oldState = this.currentState;
    this.currentState = newState;

    if (this.onStateChange && oldState !== newState) {
      this.onStateChange({
        from: oldState,
        to: newState,
        timestamp: performance.now()
      });
    }
  }

  /**
   * Get time remaining in current state
   */
  getTimeRemaining() {
    if ((this.currentState === this.states.THUMB_UP_HOLDING ||
         this.currentState === this.states.THUMB_DOWN_HOLDING) &&
        this.thumbDetectedTime) {
      const elapsed = performance.now() - this.thumbDetectedTime;
      const remaining = Math.max(0, this.config.thumbHoldDurationMs - elapsed);
      return remaining;
    }
    return 0;
  }

  /**
   * Reset detector to IDLE
   */
  reset() {
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
      this.cooldownTimeout = null;
    }

    this.currentState = this.states.IDLE;
    this.thumbDetectedTime = null;
    console.log('🔄 ThumbGestureDetector reset');
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
    this.onSwapTriggered = null;
    this.onStateChange = null;
  }
}
