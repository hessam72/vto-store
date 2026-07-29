/**
 * Gesture Debug Panel for Rings VTO
 * Shows real-time gesture detection and state machine info
 */

export class GestureDebugPanel {
  constructor(config = {}) {
    this.config = {
      enabled: true,
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
    this.panel.id = 'gestureDebugPanel';
    this.panel.style.cssText = `
      position: fixed;
      ${this.getPositionStyles()}
      background: rgba(0, 0, 0, 0.95);
      color: #00ff00;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 999;
      min-width: 300px;
      border: 2px solid #00ff00;
      backdrop-filter: blur(10px);
      max-height: 500px;
      overflow-y: auto;
    `;

    this.panel.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #FFD700;">
        👆 GESTURE DEBUG
      </div>
      <div id="gestureDebugContent"></div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #333; font-size: 10px; color: #666;">
        Press 'G' to toggle panel
      </div>
    `;

    document.body.appendChild(this.panel);

    // Toggle on 'G' key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'g' || e.key === 'G') {
        this.toggle();
      }
    });
  }

  /**
   * Get position styles
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
   * Update debug panel with gesture data
   */
  update(data) {
    if (!this.panel || !this.isVisible) return;

    this.updateFPS();

    const content = document.getElementById('gestureDebugContent');
    if (!content) return;

    const { gesture, state, timeRemaining } = data;

    let html = '';

    // FPS
    html += `<div style="color: #FFD700; margin-bottom: 8px;">FPS: ${this.stats.fps.toFixed(1)}</div>`;
    html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;

    // Gesture info
    if (gesture) {
      const confidenceColor = gesture.confidence > 0.7 ? '#51CF66' : gesture.confidence > 0.5 ? '#FFD700' : '#FF6B6B';
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">GESTURE:</div>
        <div style="color: ${confidenceColor};">
          ${gesture.category}
        </div>
        <div style="color: #999;">
          Confidence: ${(gesture.confidence * 100).toFixed(1)}%
        </div>
      </div>`;
    }

    // State machine
    if (state) {
      const stateColors = {
        'IDLE': '#666',
        'THUMB_UP_HOLDING': '#00D9FF',
        'THUMB_DOWN_HOLDING': '#FF6B6B',
        'COOLDOWN': '#FFA500'
      };

      html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">STATE:</div>
        <div style="color: ${stateColors[state] || '#666'}; font-size: 14px; font-weight: bold;">
          ${state}
        </div>
      </div>`;
    }

    // Timer with progress bar
    if ((state === 'THUMB_UP_HOLDING' || state === 'THUMB_DOWN_HOLDING') && timeRemaining > 0) {
      const maxTime = 1500;
      const progressPercent = ((maxTime - timeRemaining) / maxTime) * 100;

      html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;
      html += `<div style="margin-bottom: 8px;">
        <div style="color: #FFF; font-weight: bold;">HOLD DURATION:</div>
        <div style="color: #FFD700; font-size: 16px; font-weight: bold;">
          ${(timeRemaining / 1000).toFixed(2)}s / 1.50s
        </div>
        <div style="width: 100%; height: 6px; background: #333; border-radius: 3px; margin-top: 5px; overflow: hidden;">
          <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #00D9FF, #FFD700); border-radius: 3px; transition: width 0.1s;"></div>
        </div>
      </div>`;
    }

    // Instructions
    html += `<div style="height: 1px; background: #333; margin: 8px 0;"></div>`;
    html += `<div style="color: #999; font-size: 11px;">
      <div>👍 Thumb Up: Hold 1.5s = NEXT</div>
      <div>👎 Thumb Down: Hold 1.5s = PREV</div>
      <div style="margin-top: 5px; color: #666;">⌨️ Press 'G' to hide</div>
    </div>`;

    content.innerHTML = html;
  }

  /**
   * Update FPS
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
   * Toggle visibility
   */
  toggle() {
    if (!this.panel) return;
    this.isVisible = !this.isVisible;
    this.panel.style.display = this.isVisible ? 'block' : 'none';
    console.log(`👆 Gesture debug panel ${this.isVisible ? 'shown' : 'hidden'}`);
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
