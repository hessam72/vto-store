/**
 * VTO shared UI kit.
 *
 * Owns every piece of chrome the five try-on apps put on screen: the top bar,
 * the bottom dock, the product chip, the onboarding and detail sheets, the
 * capture/share flow, the error states and the tracking hint. An app supplies
 * its render layers and a handful of callbacks; nothing user-facing is built
 * per app any more.
 *
 * Loaded as a classic script (not a module) so it is available to the WebAR
 * earrings app, which is not module-based. Exposes `window.vtoUI`.
 *
 * Public surface used by the apps:
 *   vtoUI.setBootStage(title, tip)
 *   vtoUI.hideBoot()
 *   vtoUI.showErrorFor(error)      // classifies a DOMException / Error
 *   vtoUI.registerCapture(spec)    // { mode, layers } — see composite()
 *   vtoUI.setTracking(quality, message?)
 *   vtoUI.dockSlot                 // element an app can append controls to
 *   vtoUI.toast(message)
 */

(function () {
  'use strict';

  /* =================================================================== *
   * Icons
   *
   * Inlined rather than pulled from a Font Awesome CDN: the old @import
   * cost ~100KB and a third-party round trip on a page whose whole job is
   * to start a camera quickly.
   * =================================================================== */

  const ICON_PATHS = {
    back: 'M5 12h13M12 5l7 7-7 7',
    close: 'M6 6l12 12M18 6L6 18',
    camera: 'M3 7.5h3.2L8 4.5h8l1.8 3H21a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1zM12 17.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    cameraSwitch: 'M20.5 12a8.5 8.5 0 0 1-14.2 6.3M3.5 12a8.5 8.5 0 0 1 14.2-6.3M18 2.5V6h-3.5M6 21.5V18h3.5',
    download: 'M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5M4 20.5h16',
    share: 'M12 3v12M8 7l4-4 4 4M4.5 14v5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11.5v5M12 7.6h.01',
    check: 'M4.5 12.5l5 5L20 6.5',
    alert: 'M12 3.5L2.5 20.5h19zM12 10v4.2M12 17.6h.01',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    star: 'M12 3l2.6 5.6 6.1.8-4.4 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.3 9.4l6.1-.8z',
    shield: 'M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6z',
    award: 'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10M8.5 14L7 21l5-2.5L17 21l-1.5-7',
    weight: 'M6.5 8h11l2 12.5h-15zM9 8a3 3 0 1 1 6 0',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1.5V4M12 20v2.5M4.2 4.2L6 6M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8',
    hand: 'M8 12.5V5.6a1.5 1.5 0 0 1 3 0V11M11 11V4.4a1.5 1.5 0 0 1 3 0V11M14 11V6.6a1.5 1.5 0 0 1 3 0V13c0 4.4-2.6 7.5-6.2 7.5S5 17.4 5 13.4v-2.6a1.5 1.5 0 0 1 3 0',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 21a7.5 7.5 0 0 1 15 0',
    thumbUp: 'M7.5 21V10.2l4.4-6.9a1.9 1.9 0 0 1 2.8 2.3L13.2 9h5.3a1.9 1.9 0 0 1 1.9 2.4l-1.7 6.8a1.9 1.9 0 0 1-1.9 1.4H7.5zM7.5 10.2H4V21h3.5',
    thumbDown: 'M7.5 3v10.8l4.4 6.9a1.9 1.9 0 0 0 2.8-2.3L13.2 15h5.3a1.9 1.9 0 0 0 1.9-2.4l-1.7-6.8A1.9 1.9 0 0 0 16.8 4.4H7.5zM7.5 13.8H4V3h3.5',
    // Category marks
    earrings: 'M9.5 5.2a2.5 2.5 0 0 1 5 0v3.1M14.5 8.8l4 5.4-4 6.3-4-6.3z',
    necklace: 'M4.5 3.5v3a7.5 7.5 0 0 0 15 0v-3M12 14.8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2',
    rings: 'M12 21.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M12 8.5L8.6 6 12 2.5 15.4 6z',
    watch: 'M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M12 8.8V12l2.2 1.3M8.8 6L9.3 2.5h5.4L15.2 6M8.8 18l.5 3.5h5.4l.5-3.5',
    glasses: 'M6.5 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17.5 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M10 12.6c1.3-.9 2.7-.9 4 0M3 13V9.2l2.2-2.7M21 13V9.2l-2.2-2.7'
  };

  function icon(name, extraClass) {
    const d = ICON_PATHS[name];
    if (!d) return '';
    const cls = 'vto-icon' + (extraClass ? ' ' + extraClass : '');
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  /* =================================================================== *
   * Copy — every user-visible string lives here, in Persian.
   * =================================================================== */

  const CATEGORY_COPY = {
    earrings: {
      icon: 'earrings',
      title: 'گوشواره',
      steps: [
        { icon: 'person', text: 'صورت خود را در کادر دوربین قرار دهید' },
        { icon: 'cameraSwitch', text: 'سر خود را کمی به چپ و راست بچرخانید تا گوشواره را از هر زاویه ببینید' }
      ],
      searching: 'صورت خود را در کادر دوربین قرار دهید',
      details: {
        material: 'طلای ۱۸ عیار',
        features: ['ضد حساسیت', 'دست‌ساز', 'قفل ایمن'],
        care: 'از تماس با عطر و مواد شیمیایی پرهیز کنید',
        warranty: 'گارانتی اصالت و سلامت فیزیکی'
      }
    },
    necklace: {
      icon: 'necklace',
      title: 'گردنبند',
      steps: [
        { icon: 'person', text: 'سر و شانه‌های خود را در کادر دوربین قرار دهید' },
        { icon: 'cameraSwitch', text: 'برای دیدن نتیجه، بدن خود را به چپ و راست بچرخانید' }
      ],
      searching: 'سر و شانه‌های خود را در کادر دوربین قرار دهید',
      note: 'برای چوکر به انتهای آدرس ?product=choker را اضافه کنید',
      details: {
        material: 'طلای ۱۸ عیار با نگین‌های طبیعی',
        features: ['طراحی منحصر به فرد', 'زنجیر تنظیم‌پذیر', 'دست‌ساز'],
        care: 'در جعبه مخصوص نگهداری شود',
        warranty: 'گارانتی مادام‌العمر'
      }
    },
    rings: {
      icon: 'rings',
      title: 'انگشتر',
      steps: [
        { icon: 'hand', text: 'دست خود را در مقابل دوربین قرار دهید' },
        { icon: 'rings', text: 'انگشتر روی انگشت حلقه شما نمایش داده می‌شود' },
        { icon: 'thumbUp', text: 'شست را بالا نگه دارید برای محصول بعدی' },
        { icon: 'thumbDown', text: 'شست را پایین نگه دارید برای محصول قبلی' }
      ],
      searching: 'دست خود را در مقابل دوربین قرار دهید',
      details: {
        material: 'طلای ۱۸ عیار با الماس طبیعی',
        features: ['سایز قابل تنظیم', 'نگین اصل', 'طراحی کلاسیک'],
        care: 'حین کارهای سنگین از دست خارج کنید',
        warranty: 'گارانتی نگین و بدنه'
      }
    },
    watch: {
      icon: 'watch',
      title: 'ساعت',
      steps: [
        { icon: 'hand', text: 'دست خود را در مقابل دوربین قرار دهید' },
        { icon: 'watch', text: 'مچ خود را صاف نگه دارید تا بهترین نتیجه را ببینید' }
      ],
      searching: 'دست خود را در مقابل دوربین قرار دهید',
      note: 'برای دستبند به انتهای آدرس ?product=bracelet را اضافه کنید',
      details: {
        material: 'استیل ضد زنگ با بند چرم اصل',
        features: ['ضد آب', 'موتور ژاپنی', 'صفحه ضد خش'],
        care: 'از ضربه و رطوبت بالا پرهیز کنید',
        warranty: 'گارانتی ۲ ساله موتور'
      }
    },
    glasses: {
      icon: 'glasses',
      title: 'عینک',
      steps: [
        { icon: 'person', text: 'صورت خود را روبه‌روی دوربین و در نور کافی قرار دهید' },
        { icon: 'cameraSwitch', text: 'سر خود را آرام به چپ و راست بچرخانید تا فریم را از هر زاویه ببینید' }
      ],
      searching: 'صورت خود را در کادر دوربین قرار دهید',
      details: {
        material: 'فریم استات با عدسی ضد بازتاب',
        features: ['محافظت UV400', 'لولای فنری', 'سبک و مقاوم'],
        care: 'با دستمال میکروفایبر تمیز کنید و در کاور نگهداری شود',
        warranty: 'گارانتی ۱ ساله فریم'
      }
    }
  };

  // Product variants that only change the label, not the anatomy.
  const VARIANT_TITLES = { choker: 'چوکر', bracelet: 'دستبند' };

  const ERRORS = {
    'camera-denied': {
      title: 'دسترسی به دوربین داده نشد',
      body: 'برای امتحان مجازی، مرورگر باید به دوربین دسترسی داشته باشد.',
      steps: [
        'روی آیکون قفل کنار آدرس صفحه بزنید',
        'دسترسی «دوربین» را روی «اجازه دادن» بگذارید',
        'سپس دکمه «تلاش دوباره» را بزنید'
      ]
    },
    'camera-unavailable': {
      title: 'دوربین در دسترس نیست',
      body: 'دوربینی پیدا نشد، یا برنامه دیگری در حال استفاده از آن است. برنامه‌های دیگر را ببندید و دوباره تلاش کنید.'
    },
    'model': {
      title: 'بارگذاری محصول ناموفق بود',
      body: 'مدل سه‌بعدی این محصول بارگذاری نشد. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.'
    },
    'generic': {
      title: 'خطا در بارگذاری',
      body: 'مشکلی در راه‌اندازی امتحان مجازی پیش آمد. لطفاً صفحه را دوباره باز کنید.'
    }
  };

  /* =================================================================== *
   * Helpers
   * =================================================================== */

  const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  function toFaDigits(value) {
    return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
  }

  /**
   * sessionStorage throws outright in some privacy modes and inside sandboxed
   * frames. Remembering that the guide was dismissed is a nicety; failing to
   * read it must never take the try-on down with it.
   */
  const seen = {
    get(key) {
      try { return sessionStorage.getItem(key) === '1'; } catch (e) { return false; }
    },
    set(key) {
      try { sessionStorage.setItem(key, '1'); } catch (e) { /* not important */ }
    }
  };

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function query(target) {
    if (!target) return null;
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  /**
   * Intrinsic pixel size of a drawable source. A <video> reports its frame
   * size, a <canvas> its backing store — CSS size is irrelevant to drawImage
   * and using it is what makes composited screenshots drift.
   */
  function sourceSize(node) {
    if (!node) return null;
    if (node.tagName === 'VIDEO') {
      return node.videoWidth ? { w: node.videoWidth, h: node.videoHeight } : null;
    }
    if (node.tagName === 'IMG') {
      return node.naturalWidth ? { w: node.naturalWidth, h: node.naturalHeight } : null;
    }
    return node.width ? { w: node.width, h: node.height } : null;
  }

  /* =================================================================== *
   * The kit
   * =================================================================== */

  class VTOUI {
    constructor() {
      this.category = this.detectCategory();
      this.variant = new URLSearchParams(window.location.search).get('product');
      this.copy = CATEGORY_COPY[this.category] || CATEGORY_COPY.earrings;
      this.productData = window.VTO_PRODUCT_DATA || null;
      this.backUrl = document.body.dataset.backUrl || '/store';

      this.capture = null;
      this.shot = null;
      this.trackingState = null;
      this.openLayer = null;
      this.lastFocused = null;

      this.boot = document.getElementById('vto-boot');
      this.dockSlot = null;
    }

    detectCategory() {
      const fromBody = document.body.dataset.category;
      if (fromBody && CATEGORY_COPY[fromBody]) return fromBody;

      const path = window.location.pathname;
      if (path.includes('/earrings')) return 'earrings';
      if (path.includes('/necklace')) return 'necklace';
      if (path.includes('/rings')) return 'rings';
      if (path.includes('/watch')) return 'watch';
      if (path.includes('/glasses')) return 'glasses';
      return 'earrings';
    }

    /** Product name for the chip: the injected one, else the category label. */
    productTitle() {
      if (this.productData && this.productData.name) return this.productData.name;
      return VARIANT_TITLES[this.variant] || this.copy.title;
    }

    init() {
      this.buildTopbar();
      this.buildDock();
      this.adoptAppControls();
      this.bindGlobalKeys();
      this.showOnboarding();
    }

    /* ---- Top bar ---------------------------------------------------- */

    buildTopbar() {
      const bar = el(
        '<div class="vto-topbar">' +
          '<button type="button" class="vto-iconbtn" id="vto-back" aria-label="بازگشت به فروشگاه">' + icon('back') + '</button>' +
          '<button type="button" class="vto-iconbtn" id="changeCamera" aria-label="تعویض دوربین" hidden>' + icon('cameraSwitch') + '</button>' +
        '</div>'
      );

      // Appended, not slotted between the buttons: the chip centres itself
      // against the viewport, so its position in the flex row does not matter.
      const chip = this.buildChip();
      if (chip) bar.appendChild(chip);

      bar.querySelector('#vto-back').addEventListener('click', () => {
        window.location.href = this.backUrl;
      });

      // Rendered here but owned by the app: it keeps the `changeCamera` id the
      // apps already bind to, so bootstrap.js finds it exactly as before and
      // there is only ever one click handler on it.
      if (document.body.dataset.cameraSwitch === 'true') {
        bar.querySelector('#changeCamera').hidden = false;
      }

      document.body.appendChild(bar);
      this.topbar = bar;
    }

    buildChip() {
      const name = this.productTitle();
      if (!name) return null;

      const price = this.productData && this.productData.price
        ? this.formatPrice(this.productData.price)
        : '';

      const chip = el(
        '<button type="button" class="vto-chip" aria-label="جزئیات محصول">' +
          '<span class="vto-chip-badge">' + icon(this.copy.icon) + '</span>' +
          '<span class="vto-chip-text">' +
            '<span class="vto-chip-name"></span>' +
            (price ? '<span class="vto-chip-price"></span>' : '') +
          '</span>' +
        '</button>'
      );

      // textContent, not template interpolation: the product name comes from
      // products.json through the route handler and must never be parsed as
      // markup.
      chip.querySelector('.vto-chip-name').textContent = name;
      if (price) chip.querySelector('.vto-chip-price').textContent = price;

      chip.addEventListener('click', () => this.showDetails());
      return chip;
    }

    /* ---- Dock ------------------------------------------------------- */

    buildDock() {
      const dock = el(
        '<div class="vto-dock">' +
          '<div class="vto-hint" id="vto-hint" role="status" aria-live="polite"></div>' +
          '<div class="vto-dock-slot" id="vto-dock-slot"></div>' +
          '<button type="button" class="vto-shutter" id="vto-shutter" aria-label="عکس گرفتن">' + icon('camera') + '</button>' +
        '</div>'
      );

      dock.querySelector('#vto-shutter').addEventListener('click', () => this.captureShot());

      document.body.appendChild(dock);
      this.dock = dock;
      this.dockSlot = dock.querySelector('#vto-dock-slot');
      this.hint = dock.querySelector('#vto-hint');
    }

    /**
     * Move app-owned controls into the dock column.
     *
     * The rings app used to fix its product switcher and gesture readout to
     * the bottom of the viewport independently, which put both of them under
     * the shutter. Stacking them in one column is what stops that for good —
     * and it keeps their ids, so rings/main.js needs no change to find them.
     */
    adoptAppControls() {
      ['gestureStatus', 'productBar'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) this.dockSlot.appendChild(node);
      });
    }

    bindGlobalKeys() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.openLayer) this.closeLayer();
      });
    }

    /* ---- Boot ------------------------------------------------------- */

    setBootStage(title, tip) {
      if (!this.boot) return;
      const titleEl = this.boot.querySelector('.vto-boot-title');
      const tipEl = this.boot.querySelector('.vto-boot-tip');
      if (titleEl && title) titleEl.textContent = title;
      if (tipEl && tip !== undefined) tipEl.textContent = tip;
    }

    hideBoot() {
      if (!this.boot || this.boot.hidden) return;
      const node = this.boot;
      node.classList.add('is-leaving');
      // Matches --vto-dur-slow; the node is removed rather than left as an
      // invisible full-screen div swallowing taps.
      setTimeout(() => node.remove(), 500);
      this.boot = null;
    }

    /* ---- Sheets and modals ------------------------------------------ */

    openLayerNode(node) {
      this.closeLayer();
      this.lastFocused = document.activeElement;
      document.body.appendChild(node);
      this.openLayer = node;

      // One frame before adding the class, or the entry transition has no
      // start value to animate from.
      requestAnimationFrame(() => node.classList.add('is-visible'));

      node.addEventListener('click', (e) => {
        if (e.target === node) this.closeLayer();
      });
      const close = node.querySelector('[data-close]');
      if (close) close.addEventListener('click', () => this.closeLayer());

      const focusable = node.querySelector('button, [href], input, select, textarea');
      if (focusable) focusable.focus({ preventScroll: true });
    }

    closeLayer() {
      const node = this.openLayer;
      if (!node) return;
      this.openLayer = null;
      node.classList.remove('is-visible');
      setTimeout(() => node.remove(), 300);
      if (this.lastFocused && this.lastFocused.isConnected) {
        this.lastFocused.focus({ preventScroll: true });
      }
    }

    showOnboarding() {
      if (seen.get('vto-onboarded-' + this.category)) return;

      const steps = this.copy.steps
        .map((s) => '<li>' + icon(s.icon) + '<span></span></li>')
        .join('');

      const sheet = el(
        '<div class="vto-sheet" id="vto-onboarding" role="dialog" aria-modal="true" aria-label="راهنمای استفاده">' +
          '<div class="vto-sheet-panel">' +
            '<div class="vto-sheet-grabber"></div>' +
            '<div class="vto-sheet-head">' +
              '<div class="vto-sheet-mark">' + icon(this.copy.icon) + '</div>' +
              '<h2 class="vto-sheet-title">راهنمای استفاده</h2>' +
            '</div>' +
            '<ul class="vto-steps">' + steps +
              '<li>' + icon('sun') + '<span>در نور کافی بایستید تا تشخیص دقیق‌تر انجام شود</span></li>' +
            '</ul>' +
            (this.copy.note ? '<p class="vto-fact-body" style="margin-top:14px" id="vto-onboarding-note"></p>' : '') +
            '<div class="vto-sheet-actions">' +
              '<button type="button" class="vto-btn vto-btn--primary vto-btn--block" data-close>' + icon('check') + 'متوجه شدم</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      const slots = sheet.querySelectorAll('.vto-steps li span');
      this.copy.steps.forEach((s, i) => { slots[i].textContent = s.text; });
      if (this.copy.note) sheet.querySelector('#vto-onboarding-note').textContent = this.copy.note;

      sheet.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || e.target === sheet) {
          seen.set('vto-onboarded-' + this.category);
        }
      });

      this.openLayerNode(sheet);
    }

    /**
     * Dismiss the onboarding as soon as tracking actually succeeds — reading
     * instructions is pointless once the product is on screen.
     */
    dismissOnboarding() {
      if (this.openLayer && this.openLayer.id === 'vto-onboarding') {
        seen.set('vto-onboarded-' + this.category);
        this.closeLayer();
      }
    }

    showDetails() {
      const d = this.copy.details;
      const p = this.productData || {};

      const sheet = el(
        '<div class="vto-sheet" role="dialog" aria-modal="true" aria-label="جزئیات محصول">' +
          '<div class="vto-sheet-panel">' +
            '<button type="button" class="vto-modal-close" data-close aria-label="بستن">' + icon('close') + '</button>' +
            '<div class="vto-sheet-grabber"></div>' +
            '<div class="vto-sheet-head">' +
              '<div class="vto-sheet-mark">' + icon(this.copy.icon) + '</div>' +
              '<h2 class="vto-sheet-title"></h2>' +
              (p.price ? '<p class="vto-sheet-price"></p>' : '') +
            '</div>' +
            '<div class="vto-facts">' +
              (p.weight ? '<div class="vto-fact"><h3 class="vto-fact-title">' + icon('weight') + 'وزن</h3><p class="vto-fact-body" id="f-weight"></p></div>' : '') +
              '<div class="vto-fact"><h3 class="vto-fact-title">' + icon('layers') + 'جنس و مواد</h3><p class="vto-fact-body" id="f-material"></p></div>' +
              '<div class="vto-fact"><h3 class="vto-fact-title">' + icon('star') + 'ویژگی‌ها</h3><ul class="vto-taglist" id="f-features"></ul></div>' +
              '<div class="vto-fact"><h3 class="vto-fact-title">' + icon('shield') + 'نگهداری</h3><p class="vto-fact-body" id="f-care"></p></div>' +
              '<div class="vto-fact"><h3 class="vto-fact-title">' + icon('award') + 'گارانتی</h3><p class="vto-fact-body" id="f-warranty"></p></div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      sheet.querySelector('.vto-sheet-title').textContent = this.productTitle();
      if (p.price) sheet.querySelector('.vto-sheet-price').textContent = this.formatPrice(p.price);
      if (p.weight) sheet.querySelector('#f-weight').textContent = toFaDigits(p.weight) + ' گرم';
      sheet.querySelector('#f-material').textContent = d.material;
      sheet.querySelector('#f-care').textContent = d.care;
      sheet.querySelector('#f-warranty').textContent = d.warranty;

      const list = sheet.querySelector('#f-features');
      d.features.forEach((f) => {
        const li = el('<li>' + icon('check') + '<span></span></li>');
        li.querySelector('span').textContent = f;
        list.appendChild(li);
      });

      this.openLayerNode(sheet);
    }

    /* ---- Errors ----------------------------------------------------- */

    /** Map a thrown error onto one of the four states the UI can explain. */
    classify(error) {
      const name = (error && error.name) || '';
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        return 'camera-denied';
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' ||
          name === 'NotReadableError' || name === 'TrackStartError' ||
          name === 'OverconstrainedError') {
        return 'camera-unavailable';
      }
      const message = String((error && error.message) || '');
      if (/gltf|glb|model|load/i.test(message)) return 'model';
      return 'generic';
    }

    showErrorFor(error) {
      console.error('VTO error:', error);
      this.showError(this.classify(error));
    }

    showError(kind) {
      const spec = ERRORS[kind] || ERRORS.generic;
      this.hideBoot();

      const modal = el(
        '<div class="vto-modal" role="alertdialog" aria-modal="true">' +
          '<div class="vto-modal-panel">' +
            '<div class="vto-error">' +
              '<div class="vto-error-mark">' + icon('alert') + '</div>' +
              '<h2 class="vto-error-title"></h2>' +
              '<p class="vto-error-body"></p>' +
              (spec.steps ? '<ol class="vto-error-steps"></ol>' : '') +
              '<div class="vto-error-actions">' +
                '<button type="button" class="vto-btn vto-btn--primary vto-btn--block" id="vto-retry">تلاش دوباره</button>' +
                '<button type="button" class="vto-btn vto-btn--block" id="vto-error-back">بازگشت به فروشگاه</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      modal.querySelector('.vto-error-title').textContent = spec.title;
      modal.querySelector('.vto-error-body').textContent = spec.body;
      if (spec.steps) {
        const ol = modal.querySelector('.vto-error-steps');
        spec.steps.forEach((s) => {
          const li = document.createElement('li');
          li.textContent = s;
          ol.appendChild(li);
        });
      }

      modal.querySelector('#vto-retry').addEventListener('click', () => window.location.reload());
      modal.querySelector('#vto-error-back').addEventListener('click', () => {
        window.location.href = this.backUrl;
      });

      // No backdrop dismiss: there is nothing usable behind an unrecoverable
      // error, and a camera page with no camera is not something to fall back
      // into silently.
      this.closeLayer();
      document.body.appendChild(modal);
      this.openLayer = null;
      requestAnimationFrame(() => modal.classList.add('is-visible'));
      modal.querySelector('#vto-retry').focus({ preventScroll: true });
    }

    /* ---- Tracking hint ---------------------------------------------- */

    /**
     * @param {'none'|'poor'|'good'} quality
     * @param {string} [message] overrides the default line for this category
     */
    setTracking(quality, message) {
      if (!this.hint) return;
      if (quality === this.trackingState && !message) return;
      this.trackingState = quality;

      if (quality === 'good') {
        this.dismissOnboarding();
        this.hint.classList.remove('is-visible');
        return;
      }

      const text = message || (quality === 'poor'
        ? 'نور کافی نیست یا فاصله شما زیاد است'
        : this.copy.searching);

      this.hint.className = 'vto-hint is-visible' + (quality === 'poor' ? ' vto-hint--poor' : '');
      this.hint.textContent = text;
    }

    /* ---- Capture ----------------------------------------------------- */

    /**
     * Declare what the screenshot is made of.
     *
     * @param {Object} spec
     * @param {'viewport'|'native'} [spec.mode] 'viewport' composites at the
     *   size the user actually sees and reproduces each layer's `object-fit:
     *   cover` crop; 'native' composites at the first layer's own resolution,
     *   which is what the WebAR earrings app wants — its two canvases are
     *   already the same size and already fitted.
     * @param {Array<{el: string|Element, mirrored: boolean}>} spec.layers
     *   Back to front. `mirrored` must match the CSS transform the layer is
     *   rendered with, or the saved image comes out flipped relative to what
     *   the user was looking at. Re-register after switching cameras.
     */
    registerCapture(spec) {
      this.capture = spec;
    }

    composite() {
      const spec = this.capture;
      if (!spec || !spec.layers || !spec.layers.length) return null;

      const nodes = spec.layers
        .map((l) => ({ node: query(l.el), mirrored: !!l.mirrored }))
        .filter((l) => l.node && sourceSize(l.node));

      if (!nodes.length) return null;

      let width;
      let height;
      if (spec.mode === 'native') {
        const s = sourceSize(nodes[0].node);
        width = s.w;
        height = s.h;
      } else {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.round(window.innerWidth * dpr);
        height = Math.round(window.innerHeight * dpr);
      }

      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      nodes.forEach(({ node, mirrored }) => {
        const s = sourceSize(node);
        ctx.save();
        if (mirrored) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        if (spec.mode === 'native') {
          ctx.drawImage(node, 0, 0, width, height);
        } else {
          // Reproduce `object-fit: cover`: scale so the source covers the
          // target, then take the centred crop. The crop is horizontally
          // symmetric, so mirroring the destination above is equivalent to
          // mirroring the source and needs no adjustment here.
          const scale = Math.max(width / s.w, height / s.h);
          const sw = width / scale;
          const sh = height / scale;
          ctx.drawImage(node, (s.w - sw) / 2, (s.h - sh) / 2, sw, sh, 0, 0, width, height);
        }
        ctx.restore();
      });

      this.addBranding(ctx, width, height);
      return out.toDataURL('image/png');
    }

    /** Watermark, sized off the output so it reads the same on any device. */
    addBranding(ctx, width, height) {
      const scale = width / 1080;
      const pad = Math.round(28 * scale);
      const size = Math.max(14, Math.round(26 * scale));

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.round(8 * scale);

      const name = this.productData && this.productData.name;
      if (name) {
        ctx.font = '500 ' + Math.round(size * 0.78) + 'px Vazirmatn, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(name, width - pad, height - pad - size * 1.25);
      }

      ctx.font = '700 ' + size + 'px Vazirmatn, sans-serif';
      ctx.fillStyle = '#d4af37';
      ctx.fillText('VTO Store', width - pad, height - pad);
      ctx.restore();
    }

    captureShot() {
      const btn = document.getElementById('vto-shutter');
      const data = this.composite();

      if (!data) {
        this.toast('عکس‌برداری در دسترس نیست — هنوز آماده نشده است');
        return;
      }

      this.shot = data;
      if (btn) {
        btn.classList.add('is-capturing');
        setTimeout(() => btn.classList.remove('is-capturing'), 450);
      }
      setTimeout(() => this.showShare(), 320);
    }

    showShare() {
      const modal = el(
        '<div class="vto-modal" role="dialog" aria-modal="true" aria-label="تصویر گرفته‌شده">' +
          '<div class="vto-modal-panel">' +
            '<button type="button" class="vto-modal-close" data-close aria-label="بستن">' + icon('close') + '</button>' +
            '<img class="vto-shot" alt="تصویر امتحان مجازی">' +
            '<div class="vto-shot-actions">' +
              '<button type="button" class="vto-btn vto-btn--primary" data-action="download">' + icon('download') + 'دانلود</button>' +
              '<button type="button" class="vto-btn" data-action="share">' + icon('share') + 'اشتراک‌گذاری</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      modal.querySelector('.vto-shot').src = this.shot;
      modal.querySelector('[data-action="download"]').addEventListener('click', () => this.download());
      modal.querySelector('[data-action="share"]').addEventListener('click', () => this.share());

      this.openLayerNode(modal);
    }

    download() {
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const name = (this.productTitle() || 'vto').replace(/\s+/g, '-');
      link.download = name + '-' + stamp + '.png';
      link.href = this.shot;
      link.click();
      this.toast('تصویر دانلود شد');
    }

    async share() {
      try {
        const blob = await (await fetch(this.shot)).blob();
        const file = new File([blob], 'vto-capture.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: this.productTitle(),
            text: 'تصویر امتحان مجازی من'
          });
          return;
        }
        this.toast('اشتراک‌گذاری در این مرورگر پشتیبانی نمی‌شود — تصویر را دانلود کنید');
      } catch (error) {
        // A user dismissing the OS share sheet lands here too; that is not a
        // failure worth telling them about.
        if (error && error.name === 'AbortError') return;
        console.error('Share failed:', error);
        this.toast('اشتراک‌گذاری انجام نشد');
      }
    }

    /* ---- Toast ------------------------------------------------------- */

    toast(message) {
      if (this.toastNode) this.toastNode.remove();
      const node = el('<div class="vto-toast" role="status" aria-live="polite"></div>');
      node.textContent = message;
      document.body.appendChild(node);
      this.toastNode = node;

      requestAnimationFrame(() => node.classList.add('is-visible'));
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        node.classList.remove('is-visible');
        setTimeout(() => node.remove(), 300);
      }, 2800);
    }

    /* ---- Formatting -------------------------------------------------- */

    /**
     * products.json stores prices as pre-grouped strings ("2,500,000"), while
     * the defaults in the route handler are numbers. Both have to come out as
     * Persian digits.
     */
    formatPrice(price) {
      if (price === null || price === undefined || price === '') return '';
      if (typeof price === 'number') {
        return price.toLocaleString('fa-IR') + ' تومان';
      }
      return toFaDigits(String(price).trim()) + ' تومان';
    }
  }

  function boot() {
    window.vtoUI = new VTOUI();
    window.vtoUI.init();
  }

  // Deliberately NOT waiting for DOMContentLoaded. Each page loads this script
  // at the end of <body>, after the nodes it adopts (#vto-boot, #productBar,
  // #gestureStatus), and the app entry points are ES modules — which run after
  // parsing but still BEFORE DOMContentLoaded. Waiting for that event would
  // leave `window.vtoUI` and `#changeCamera` undefined at the exact moment
  // bootstrap.js goes looking for them.
  if (document.body) {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
