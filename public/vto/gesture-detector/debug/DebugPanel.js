/**
 * Debug Panel for Gesture Detector
 * Shows real-time gesture info, state machine, and performance metrics
 */

export class DebugPanel {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      showLandmarks: false,
      showGestureInfo: true,
      showTimer: true,
      showStateMachine: true,
      panelPosition: 'top-left',
      ...config
    };

    this.panel = null;
    this.isVisible = true;
    this.stats = {
      fps: 0,
      lastFrameTime: performance.now(),
      frameCount: 0
    };

    if (this.config.enabled) {
      this.createPanel();
    }
  }

  /**
   * Create debug panel UI
   */
  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'debugPanel';
    this.panel.style.cssText = `
      position: fixed;
      ${this.getPositionStyles()}
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      min-width: 280px;
      border: 1px solid #00ff00;
      backdrop-filter: blur(10px);
    `;

    this.panel.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #FFD700;">
        🎛️ DEBUG PANEL
      </div>
      <div id="debugContent"></div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #333; font-size: 10px; color: #666;">
        Press 'D' to toggle panel
      </div>
    `;

    document.body.appendChild(this.panel);
  }

  /**
   * Get position styles based on config
   */
  getPositionStyles() {
    const positions = {
      'top-left': 'top: 100px; left: 20px;',
      'top-right': 'top: 100px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;'
    };
    return positions[this.config.panelPosition] || positions['top-left'];
  }

  /**
   * Update debug panel with current data
   */
  update(data) {
    if (!this.panel || !this.isVisible) return;

    // Update FPS
    this.updateFPS();

    const content = document.getElementById('debugContent');
    if (!content) return;

    const { gesture, state, timeRemaining, handPosition } = data;

    let html = '';

    // FPS
    html += `<div style="color: #FFD700;">FPS: ${this.stats.fps.toFixed(1)}</div>`;
    html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;

    // Gesture info
    if (this.config.showGestureInfo && gesture) {
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">GESTURE:</div>
        <div style="color: ${gesture.confidence > 0.7 ? '#51CF66' : '#FF6B6B'};">
          ${gesture.category}
        </div>
        <div style="color: #999;">
          Confidence: ${(gesture.confidence * 100).toFixed(1)}%
        </div>
      </div>`;
    }

    // State machine
    if (this.config.showStateMachine) {
      const stateColors = {
        'IDLE': '#666',
        'FIST_DETECTED': '#FF6B6B',
        'THUMB_UP_HOLDING': '#00D9FF',
        'THUMB_DOWN_HOLDING': '#00D9FF',
        'PALM_DETECTED': '#51CF66',
        'COOLDOWN': '#FFA500'
      };

      html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">STATE MACHINE:</div>
        <div style="color: ${stateColors[state] || '#666'}; font-size: 14px;">
          ${state}
        </div>
      </div>`;
    }

    // Timer
    if (this.config.showTimer && timeRemaining > 0) {
      // Calculate progress bar percentage
      let progressPercent = 0;
      let maxTime = 3000;

      if (state === 'FIST_DETECTED') {
        // Fist: countdown from 3000ms
        maxTime = 3000;
        progressPercent = (timeRemaining / maxTime) * 100;
      } else if (state === 'THUMB_UP_HOLDING' || state === 'THUMB_DOWN_HOLDING') {
        // Thumb: count up to 1500ms (invert progress)
        maxTime = 1500;
        progressPercent = ((maxTime - timeRemaining) / maxTime) * 100;
      }

      html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">TIME REMAINING:</div>
        <div style="color: #FFD700; font-size: 16px;">
          ${(timeRemaining / 1000).toFixed(2)}s
        </div>
        <div style="width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 5px;">
          <div style="width: ${progressPercent}%; height: 100%; background: #FFD700; border-radius: 2px; transition: width 0.1s;"></div>
        </div>
      </div>`;
    }

    // Hand position
    if (handPosition) {
      html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">HAND POSITION:</div>
        <div style="color: #999;">
          X: ${handPosition.x.toFixed(3)}<br>
          Y: ${handPosition.y.toFixed(3)}
        </div>
        <div style="color: #00ffff; margin-top: 5px;">
          Direction: ${handPosition.x < 0.5 ? 'LEFT (Prev)' : 'RIGHT (Next)'}
        </div>
      </div>`;
    }

    content.innerHTML = html;
  }

  /**
   * Update FPS calculation
   */
  updateFPS() {
    const now = performance.now();
    this.stats.frameCount++;

    const elapsed = now - this.stats.lastFrameTime;
    if (elapsed >= 1000) {
      this.stats.fps = this.stats.frameCount / (elapsed / 1000);
      this.stats.frameCount = 0;
      this.stats.lastFrameTime = now;
    }
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (!this.panel) return;

    this.isVisible = !this.isVisible;
    this.panel.style.display = this.isVisible ? 'block' : 'none';
    console.log(`🎛️ Debug panel ${this.isVisible ? 'shown' : 'hidden'}`);
  }

  /**
   * Show panel
   */
  show() {
    if (!this.panel) return;
    this.isVisible = true;
    this.panel.style.display = 'block';
  }

  /**
   * Hide panel
   */
  hide() {
    if (!this.panel) return;
    this.isVisible = false;
    this.panel.style.display = 'none';
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }
}
