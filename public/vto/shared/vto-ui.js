/**
 * VTO UI Components - Shared functionality for all VTO apps
 */

class VTOUIManager {
  constructor() {
    this.productData = window.VTO_PRODUCT_DATA || null;
    this.capturedImage = null;
    this.isCollapsed = false;
    this.trackingQuality = 'none'; // none, poor, good
  }

  /**
   * Initialize all UI components
   */
  init() {
    this.createProductCard();
    this.createCaptureButton();
    this.enhanceLoadingScreen();
    this.createTrackingFeedback();
  }

  /**
   * Create floating product info card
   */
  createProductCard() {
    if (!this.productData) return;

    const card = document.createElement('div');
    card.className = 'vto-product-card';
    card.innerHTML = `
      <button class="vto-collapse-btn" aria-label="کوچک کردن"><i class="fa-solid fa-minus"></i></button>
      <div class="vto-product-details">
        <h3 class="vto-product-name">${this.productData.name}</h3>
        ${this.productData.price ? `<p class="vto-product-price">${this.formatPrice(this.productData.price)}</p>` : ''}
        ${this.productData.weight ? `<p class="vto-product-weight">وزن: ${this.productData.weight} گرم</p>` : ''}
      </div>
    `;

    document.body.appendChild(card);

    // Collapse toggle
    const collapseBtn = card.querySelector('.vto-collapse-btn');
    collapseBtn.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      card.classList.toggle('collapsed', this.isCollapsed);
      collapseBtn.innerHTML = this.isCollapsed ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-minus"></i>';
      collapseBtn.setAttribute('aria-label', this.isCollapsed ? 'بزرگ کردن' : 'کوچک کردن');
    });

    // Click to expand when collapsed
    card.addEventListener('click', (e) => {
      if (this.isCollapsed && e.target === card) {
        this.isCollapsed = false;
        card.classList.remove('collapsed');
        collapseBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
        collapseBtn.setAttribute('aria-label', 'کوچک کردن');
      }
    });
  }

  /**
   * Create capture button
   */
  createCaptureButton() {
    const btn = document.createElement('button');
    btn.className = 'vto-capture-btn';
    btn.innerHTML = '<i class="fa-solid fa-camera"></i>';
    btn.setAttribute('aria-label', 'عکس برداری');

    btn.addEventListener('click', () => {
      this.captureScreenshot();
    });

    document.body.appendChild(btn);
  }

  /**
   * Capture screenshot from canvas
   */
  captureScreenshot() {
    // Get video feed canvas (background layer)
    const videoCanvas = document.getElementById('WebARRocksFaceCanvas') ||
                        document.getElementById('handTrackerCanvas');

    // Get 3D model canvas (overlay layer)
    const modelCanvas = document.getElementById('threeCanvas') ||
                        document.getElementById('canvas');

    if (!modelCanvas) {
      console.error('Model canvas not found');
      return;
    }

    const btn = document.querySelector('.vto-capture-btn');
    btn.classList.add('capturing');

    // Create temp canvas for compositing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = modelCanvas.width;
    tempCanvas.height = modelCanvas.height;
    const ctx = tempCanvas.getContext('2d');

    // Layer 1: Draw video feed (if available)
    if (videoCanvas) {
      ctx.drawImage(videoCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    // Layer 2: Draw 3D model overlay
    ctx.drawImage(modelCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

    // Convert to image
    this.capturedImage = tempCanvas.toDataURL('image/png');

    // Show share modal
    setTimeout(() => {
      btn.classList.remove('capturing');
      this.showShareModal();
    }, 500);
  }

  /**
   * Add branding watermark to canvas
   */
  addBrandingToCanvas(ctx, width, height) {
    // Bottom-right watermark
    ctx.font = 'bold 24px Vazirmatn, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'right';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 3;

    const watermarkText = 'VTO Store';
    const x = width - 20;
    const y = height - 20;

    ctx.strokeText(watermarkText, x, y);
    ctx.fillText(watermarkText, x, y);

    // Optional: Add product name if available
    if (this.productData && this.productData.name) {
      ctx.font = '18px Vazirmatn, sans-serif';
      ctx.strokeText(this.productData.name, x, y - 30);
      ctx.fillText(this.productData.name, x, y - 30);
    }
  }

  /**
   * Show share modal with captured image
   */
  showShareModal() {
    const modal = document.createElement('div');
    modal.className = 'vto-share-modal';
    modal.innerHTML = `
      <div class="vto-share-content">
        <button class="vto-close-modal" aria-label="بستن"><i class="fa-solid fa-xmark"></i></button>
        <img src="${this.capturedImage}" alt="تصویر گرفته شده" class="vto-share-preview">
        <div class="vto-share-buttons">
          <button class="vto-share-btn primary" data-action="download">
            <i class="fa-solid fa-download"></i> دانلود
          </button>
          <button class="vto-share-btn" data-action="share">
            <i class="fa-solid fa-share-nodes"></i> اشتراک‌گذاری
          </button>
          <button class="vto-share-btn" data-action="back">
            <i class="fa-solid fa-arrow-right"></i> بازگشت 
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.vto-close-modal').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('[data-action="download"]').addEventListener('click', () => {
      this.downloadImage();
    });

    modal.querySelector('[data-action="share"]').addEventListener('click', () => {
      this.shareImage();
    });

    modal.querySelector('[data-action="back"]').addEventListener('click', () => {
      // window.history.back();
        modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Download captured image
   */
  downloadImage() {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const productName = this.productData?.name?.replace(/\s+/g, '-') || 'vto';
    link.download = `${productName}-${timestamp}.png`;
    link.href = this.capturedImage;
    link.click();
  }

  /**
   * Share image using Web Share API
   */
  async shareImage() {
    try {
      // Convert data URL to blob
      const response = await fetch(this.capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'vto-capture.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: this.productData?.name || 'Virtual Try-On',
          text: 'تصویر امتحان مجازی من'
        });
      } else {
        // Fallback: copy to clipboard or show message
        alert('اشتراک‌گذاری در این مرورگر پشتیبانی نمی‌شود. لطفاً تصویر را دانلود کنید.');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  }

  /**
   * Enhance loading screen
   */
  enhanceLoadingScreen() {
    // Replace existing loading modals
    const existingLoading = document.querySelector('#loading-modal, .loading');
    if (existingLoading) {
      const overlay = document.createElement('div');
      overlay.className = 'vto-loading-overlay';
      overlay.id = 'vto-loading';
      overlay.innerHTML = `
        <div class="vto-loading-spinner"></div>
        <p class="vto-loading-text">در حال بارگذاری...</p>
        <p class="vto-loading-tip">لطفاً صبر کنید تا دوربین آماده شود</p>
      `;

      existingLoading.replaceWith(overlay);
    }
  }

  /**
   * Hide loading screen with animation
   */
  hideLoading() {
    const loading = document.getElementById('vto-loading') ||
                     document.getElementById('loading-modal') ||
                     document.querySelector('.loading');

    if (loading) {
      loading.classList.add('fade-out');
      setTimeout(() => loading.remove(), 500);
    }
  }

  /**
   * Create tracking feedback overlay
   */
  createTrackingFeedback() {
    const feedback = document.createElement('div');
    feedback.className = 'vto-tracking-feedback';
    feedback.id = 'vto-tracking-feedback';
    document.body.appendChild(feedback);
  }

  /**
   * Update tracking feedback
   * @param {string} quality - 'good', 'poor', or 'none'
   * @param {string} message - Feedback message in Persian
   */
  updateTrackingFeedback(quality, message) {
    const feedback = document.getElementById('vto-tracking-feedback');
    if (!feedback) return;

    feedback.className = 'vto-tracking-feedback';
    feedback.classList.add('visible');

    if (quality !== 'none') {
      feedback.classList.add(quality);
    }

    feedback.textContent = message;

    // Auto-hide good tracking feedback
    if (quality === 'good') {
      setTimeout(() => {
        feedback.classList.remove('visible');
      }, 2000);
    }
  }

  /**
   * Format price for display
   */
  formatPrice(price) {
    if (typeof price === 'number') {
      return `${price.toLocaleString('fa-IR')} تومان`;
    }
    return price;
  }

  /**
   * Get product data from window
   */
  static getProductData() {
    return window.VTO_PRODUCT_DATA || null;
  }

  /**
   * Set product data
   */
  static setProductData(data) {
    window.VTO_PRODUCT_DATA = data;
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.vtoUI = new VTOUIManager();
    window.vtoUI.init();
  });
} else {
  window.vtoUI = new VTOUIManager();
  window.vtoUI.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VTOUIManager;
}
