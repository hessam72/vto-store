/**
 * Fist-to-Palm Gesture Detector
 * State machine: IDLE → FIST_DETECTED → PALM_DETECTED (trigger) → COOLDOWN → IDLE
 */

export class FistPalmDetector {
  constructor(config = {}) {
    this.config = {
      minConfidence: 0.7,
      minPalmConfidence: 0.4, // Lower threshold for Open_Palm detection
      fistToPalmTimeoutMs: 3000,
      thumbHoldDurationMs: 1500, // Hold thumb gesture for 1.5 seconds
      cooldownMs: 1000,
      screenDivisionRatio: 0.5,
      ...config
    };

    // State machine states
    this.states = {
      IDLE: 'IDLE',
      FIST_DETECTED: 'FIST_DETECTED',
      PALM_DETECTED: 'PALM_DETECTED',
      THUMB_UP_HOLDING: 'THUMB_UP_HOLDING',
      THUMB_DOWN_HOLDING: 'THUMB_DOWN_HOLDING',
      COOLDOWN: 'COOLDOWN'
    };

    this.currentState = this.states.IDLE;
    this.fistDetectedTime = null;
    this.thumbDetectedTime = null;
    this.cooldownTimeout = null;
    this.lastHandPosition = { x: 0, y: 0 };

    // Event callbacks
    this.onSwapTriggered = null;
    this.onStateChange = null;
  }

  /**
   * Process gesture results from MediaPipe
   */
  process(results) {
    const { gestures, landmarks } = results;

    // Extract dominant gesture
    const dominantGesture = this.getDominantGesture(gestures);

    // Update hand position if landmarks available
    if (landmarks && landmarks.length > 0) {
      // Use wrist (landmark 0) as reference
      this.lastHandPosition = {
        x: landmarks[0].x,
        y: landmarks[0].y
      };
    }

    // State machine logic
    this.updateStateMachine(dominantGesture);

    return {
      state: this.currentState,
      gesture: dominantGesture,
      timeRemaining: this.getTimeRemaining(),
      handPosition: this.lastHandPosition
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
        if (isValidGesture && category === 'Closed_Fist') {
          this.transitionTo(this.states.FIST_DETECTED);
          this.fistDetectedTime = now;
          console.log('🤜 Fist detected - waiting for palm...');
        } else if (isValidGesture && category === 'Thumb_Up') {
          this.transitionTo(this.states.THUMB_UP_HOLDING);
          this.thumbDetectedTime = now;
          console.log('👍 Thumb up detected - hold for 1.5s...');
        } else if (isValidGesture && category === 'Thumb_Down') {
          this.transitionTo(this.states.THUMB_DOWN_HOLDING);
          this.thumbDetectedTime = now;
          console.log('👎 Thumb down detected - hold for 1.5s...');
        }
        break;

      case this.states.FIST_DETECTED:
        const elapsed = now - this.fistDetectedTime;

        if (category === 'Open_Palm' && confidence >= this.config.minPalmConfidence) {
          // Successful sequence: Fist → Palm (lower confidence threshold for palm)
          this.transitionTo(this.states.PALM_DETECTED);
          this.triggerSwap('fist-palm');
        } else if (elapsed > this.config.fistToPalmTimeoutMs) {
          // Timeout: reset to IDLE
          console.log('⏱️ Fist-to-palm timeout - resetting');
          this.transitionTo(this.states.IDLE);
          this.fistDetectedTime = null;
        } else if (isValidGesture && category !== 'Closed_Fist' && category !== 'Open_Palm') {
          // Different unwanted gesture detected (not None, not Closed_Fist, not Open_Palm): reset
          console.log(`❌ Unwanted gesture "${category}" - resetting`);
          this.transitionTo(this.states.IDLE);
          this.fistDetectedTime = null;
        }
        // Stay in FIST_DETECTED if: Closed_Fist, None, or low-confidence gesture
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

      case this.states.PALM_DETECTED:
        // Immediately transition to cooldown
        this.transitionTo(this.states.COOLDOWN);
        this.startCooldown();
        break;

      case this.states.COOLDOWN:
        // Waiting for cooldown to expire (handled by timeout)
        break;
    }
  }

  /**
   * Trigger swap action
   */
  triggerSwap(type = 'fist-palm') {
    let direction;

    if (type === 'fist-palm') {
      // Fist→Palm: determine direction based on hand position
      // Left half of screen = previous, right half = next
      direction = this.lastHandPosition.x < this.config.screenDivisionRatio ? 'previous' : 'next';
      console.log(`✋ Palm detected - SWAP TRIGGERED! (${direction})`);
    } else {
      // Thumb gestures: explicit direction
      direction = type; // 'next' or 'previous'
    }

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
      this.fistDetectedTime = null;
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
    if (this.currentState === this.states.FIST_DETECTED && this.fistDetectedTime) {
      const elapsed = performance.now() - this.fistDetectedTime;
      const remaining = Math.max(0, this.config.fistToPalmTimeoutMs - elapsed);
      return remaining;
    } else if ((this.currentState === this.states.THUMB_UP_HOLDING ||
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
    this.fistDetectedTime = null;
    this.thumbDetectedTime = null;
    console.log('🔄 FistPalmDetector reset');
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
