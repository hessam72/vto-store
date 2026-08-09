/**
 * Every string on the About page, in both languages.
 *
 * Headings are split into segments so a word can be flagged `gold: true` — the
 * design rule is "bold white heading, only key words in gold". Mirrors the
 * `HeadingSegment` shape used by the landing page so the treatment survives
 * translation instead of being baked into markup.
 *
 * This file is part of the portable `components/about` module: it imports
 * nothing, so it travels with the folder.
 */

export type Lang = "fa" | "en";

export type Seg = { text: string; gold?: boolean };

/** Keys map 1:1 to the glyphs exported by ./icons. */
export type ServiceIcon =
  | "showroom"
  | "product"
  | "realestate"
  | "automotive"
  | "jewelry"
  | "tryon"
  | "events"
  | "booking";

export type Slot = { src: string; alt: string; label: string };

export type Service = {
  icon: ServiceIcon;
  title: string;
  description: string;
  image: Slot;
};

export type AboutCopy = {
  brand: { name: string; tagline: string };
  ui: {
    skip: string;
    home: string;
    backHome: string;
    langLabel: string;
    scrollCue: string;
  };
  hero: {
    eyebrow: string;
    heading: Seg[];
    lead: string;
    image: Slot;
  };
  intro: { paragraphs: string[] };
  mission: {
    eyebrow: string;
    heading: Seg[];
    paragraphs: string[];
    image: Slot;
  };
  services: {
    eyebrow: string;
    heading: Seg[];
    lead: string;
    items: Service[];
  };
  vision: {
    eyebrow: string;
    heading: Seg[];
    paragraphs: string[];
    quote: string;
    image: Slot;
  };
  footer: { note: string };
};

/** Brand logo. Falls back to a gold wordmark when the file is absent. */
export const ABOUT_LOGO = "/images/shahr-omid-logo.png";

/** Where the page links "home" to. Change once when porting. */
export const ABOUT_HOME_HREF = "/";

export const ABOUT: Record<Lang, AboutCopy> = {
  /* ───────────────────────────── Persian ───────────────────────────── */
  fa: {
    brand: {
      name: "شهر واقعیت مجازی امید",
      tagline: "تجربه‌های دیجیتال سه‌بعدی برای کسب‌وکارها",
    },
    ui: {
      skip: "رفتن به محتوای اصلی",
      home: "خانه",
      backHome: "بازگشت به خانه",
      langLabel: "انتخاب زبان",
      scrollCue: "بیشتر بدانید",
    },
    hero: {
      eyebrow: "درباره ما",
      heading: [
        { text: "شهری که در آن\n" },
        { text: "تجربه", gold: true },
        { text: " ساخته می‌شود" },
      ],
      lead: "شهر واقعیت مجازی امید (Omid Virtual City) مجموعه‌ای از راهکارهای هوشمند مبتنی بر فناوری‌های سه‌بعدی، واقعیت افزوده (AR)، واقعیت مجازی (VR) و WebGL است که با هدف ایجاد نسل جدیدی از تجربه‌های دیجیتال برای کسب‌وکارها طراحی شده است.",
      image: {
        src: "/images/about/hero.webp",
        alt: "نمای شهر واقعیت مجازی امید",
        label: "تصویر اصلی صفحه",
      },
    },
    intro: {
      paragraphs: [
        "ما باور داریم آینده اینترنت فراتر از صفحات دوبعدی و تصاویر ثابت خواهد بود. در آینده، کاربران تنها یک محصول را مشاهده نمی‌کنند؛ بلکه آن را تجربه خواهند کرد، با آن تعامل خواهند داشت و پیش از تصمیم‌گیری، در فضای دیجیتال آن حضور پیدا می‌کنند.",
        "بر همین اساس، شهر واقعیت مجازی امید بستری را توسعه داده است که کسب‌وکارها بتوانند محصولات، خدمات و فضاهای خود را به محیط‌های سه‌بعدی تعاملی تبدیل کنند؛ محیط‌هایی که بدون نیاز به نصب هیچ نرم‌افزاری و تنها از طریق مرورگر، روی موبایل، تبلت و کامپیوتر در دسترس کاربران قرار می‌گیرند.",
      ],
    },
    mission: {
      eyebrow: "ماموریت ما",
      heading: [
        { text: "فناوری، ابزاری برای حل " },
        { text: "مسائل واقعی", gold: true },
      ],
      paragraphs: [
        "ماموریت ما تنها ساخت مدل‌های سه‌بعدی یا محیط‌های واقعیت مجازی نیست؛ بلکه طراحی تجربه‌هایی است که به کسب‌وکارها کمک می‌کند محصولات خود را بهتر معرفی کنند، اعتماد مشتریان را افزایش دهند، فرآیند تصمیم‌گیری را ساده‌تر کنند و نرخ تبدیل بازدیدکننده به خریدار را بهبود ببخشند.",
        "ما فناوری را ابزاری برای حل مسائل واقعی کسب‌وکارها می‌دانیم؛ از کاهش ابهام در خرید گرفته تا ایجاد تجربه‌ای متفاوت که مشتری بتواند محصول یا خدمت را پیش از خرید، به‌صورت واقعی مشاهده و ارزیابی کند.",
      ],
      image: {
        src: "/images/about/mission-2.webp",
        alt: "طراحی تجربه‌های سه‌بعدی برای کسب‌وکارها",
        label: "تصویر ماموریت",
      },
    },
    services: {
      eyebrow: "خدمات و راهکارها",
      heading: [
        { text: "پلتفرم‌های تخصصی برای " },
        { text: "هر صنعت", gold: true },
      ],
      lead: "شهر واقعیت مجازی امید مجموعه‌ای از پلتفرم‌های تخصصی را برای صنایع مختلف توسعه داده است که هرکدام متناسب با نیاز همان حوزه طراحی شده‌اند.",
      items: [
        {
          icon: "showroom",
          title: "نمایشگاه‌ها و شوروم‌های سه‌بعدی",
          description:
            "طراحی شوروم‌های دیجیتال برای برندها و تولیدکنندگان که کاربران بتوانند محصولات را در محیطی واقع‌گرایانه مشاهده کنند، میان مدل‌ها جابه‌جا شوند، رنگ و متریال را تغییر دهند و تجربه‌ای نزدیک به بازدید حضوری داشته باشند.",
          image: {
            src: "/images/about/service-showroom.webp",
            alt: "شوروم سه‌بعدی دیجیتال",
            label: "تصویر شوروم سه‌بعدی",
          },
        },
        {
          icon: "product",
          title: "تجربه تعاملی محصولات",
          description:
            "ایجاد نمایش سه‌بعدی محصولات همراه با قابلیت چرخش، بررسی جزئیات، شخصی‌سازی و نمایش واقعیت افزوده (AR) برای کمک به تصمیم‌گیری سریع‌تر مشتری.",
          image: {
            src: "/images/about/service-product.webp",
            alt: "نمایش تعاملی سه‌بعدی محصول",
            label: "تصویر تجربه محصول",
          },
        },
        {
          icon: "realestate",
          title: "بازدید مجازی املاک",
          description:
            "ایجاد تجربه بازدید تعاملی از پروژه‌های ساختمانی، مجتمع‌های مسکونی و املاک، همراه با نمایش سه‌بعدی فضاها و امکانات اطراف پروژه.",
          image: {
            src: "/images/about/service-realestate.webp",
            alt: "بازدید مجازی از پروژه ساختمانی",
            label: "تصویر بازدید املاک",
          },
        },
        {
          icon: "automotive",
          title: "نمایشگاه خودرو",
          description:
            "طراحی نمایشگاه‌های دیجیتال خودرو با امکان بررسی کامل خودرو، مشاهده جزئیات، تغییر رنگ، متریال و تجربه تعاملی پیش از خرید.",
          image: {
            src: "/images/about/service-automotive.webp",
            alt: "نمایشگاه دیجیتال خودرو",
            label: "تصویر نمایشگاه خودرو",
          },
        },
        {
          icon: "jewelry",
          title: "راهکارهای صنعت طلا و جواهر",
          description:
            "نمایش سه‌بعدی محصولات، ساخت ویترین‌های دیجیتال و توسعه تجربه‌های تعاملی برای معرفی مجموعه‌های طلا و جواهر.",
          image: {
            src: "/images/about/service-jewelry.webp",
            alt: "ویترین دیجیتال طلا و جواهر",
            label: "تصویر طلا و جواهر",
          },
        },
        {
          icon: "tryon",
          title: "تجربه پرو مجازی جواهرات",
          description:
            "قبل از خرید کالا با استفاده از دوربین تلفن همراه خود، جواهرات و اکسسوری مورد علاقه‌تان را بپوشید.",
          image: {
            src: "/images/about/service-tryon.webp",
            alt: "پرو مجازی جواهرات با دوربین موبایل",
            label: "تصویر پرو مجازی",
          },
        },
        {
          icon: "events",
          title: "سامانه‌های رویداد و بلیت",
          description:
            "طراحی سیستم‌های خرید بلیت همراه با نمایش سه‌بعدی سالن، انتخاب صندلی بر اساس دید واقعی و تجربه دقیق فضای رویداد پیش از خرید.",
          image: {
            src: "/images/about/service-events.webp",
            alt: "نمایش سه‌بعدی سالن و انتخاب صندلی",
            label: "تصویر رویداد و بلیت",
          },
        },
        {
          icon: "booking",
          title: "رزرو خدمات",
          description:
            "توسعه سامانه‌های رزرو هوشمند همراه با نمایش سه‌بعدی محیط، خدمات و تجربه کاربری تعاملی برای کسب‌وکارهای خدماتی.",
          image: {
            src: "/images/about/service-booking.webp",
            alt: "سامانه رزرو هوشمند خدمات",
            label: "تصویر رزرو خدمات",
          },
        },
      ],
    },
    vision: {
      eyebrow: "چشم‌انداز ما",
      heading: [
        { text: "اکوسیستمی یکپارچه از " },
        { text: "تجربه‌های دیجیتال", gold: true },
      ],
      paragraphs: [
        "چشم‌انداز شهر واقعیت مجازی امید، ساخت اکوسیستمی یکپارچه از تجربه‌های دیجیتال است؛ شهری که در آن فروشگاه‌ها، نمایشگاه‌ها، پروژه‌های ساختمانی، مراکز خدماتی، رویدادها و کسب‌وکارها در قالب محیط‌های سه‌بعدی هوشمند به یکدیگر متصل شده‌اند.",
        "ما معتقدیم نسل آینده وب، تنها نمایش اطلاعات نیست؛ بلکه خلق تجربه است. تجربه‌ای که مرز میان دنیای فیزیکی و دیجیتال را از بین می‌برد و به کاربران این امکان را می‌دهد تا پیش از هر تصمیم، آن را احساس کنند، بررسی کنند و با اطمینان بیشتری انتخاب نمایند.",
      ],
      quote:
        "در شهر واقعیت مجازی امید، ما فقط محیط‌های سه‌بعدی نمی‌سازیم؛ ما تجربه‌هایی خلق می‌کنیم که به کسب‌وکارها کمک می‌کند بهتر دیده شوند، بهتر معرفی شوند و مؤثرتر بفروشند.",
      image: {
        src: "/images/about/vision.webp",
        alt: "اکوسیستم به‌هم‌پیوسته شهر واقعیت مجازی",
        label: "تصویر چشم‌انداز",
      },
    },
    footer: {
      note: "شهر واقعیت مجازی امید — جایی که کسب‌وکارها دیده می‌شوند.",
    },
  },

  /* ───────────────────────────── English ───────────────────────────── */
  en: {
    brand: {
      name: "Omid Virtual City",
      tagline: "Immersive 3D experiences for business",
    },
    ui: {
      skip: "Skip to main content",
      home: "Home",
      backHome: "Back to home",
      langLabel: "Select language",
      scrollCue: "Discover more",
    },
    hero: {
      eyebrow: "About us",
      heading: [
        { text: "A city built for\n" },
        { text: "experience", gold: true },
      ],
      lead: "Omid Virtual City is a suite of intelligent solutions built on 3D, augmented reality (AR), virtual reality (VR) and WebGL technologies — designed to create a new generation of digital experiences for business.",
      image: {
        src: "/images/about/hero.webp",
        alt: "A view of Omid Virtual City",
        label: "Hero image",
      },
    },
    intro: {
      paragraphs: [
        "We believe the future of the internet reaches far beyond flat pages and static images. Tomorrow's users will not merely look at a product — they will experience it, interact with it, and step into its digital space before they ever make a decision.",
        "That belief is why Omid Virtual City has built a platform that turns products, services and spaces into interactive 3D environments — environments that need no software installation and open straight in the browser, on phones, tablets and desktops alike.",
      ],
    },
    mission: {
      eyebrow: "Our mission",
      heading: [
        { text: "Technology as a tool for " },
        { text: "real problems", gold: true },
      ],
      paragraphs: [
        "Our mission is not simply to build 3D models or virtual reality environments. It is to design experiences that help businesses present their products more clearly, earn their customers' trust, simplify the path to a decision, and convert more visitors into buyers.",
        "We treat technology as a means of solving genuine business problems — from removing the uncertainty of buying online, to creating an experience where a customer can truly see and evaluate a product or service before committing to it.",
      ],
      image: {
        src: "/images/about/mission.webp",
        alt: "Designing 3D experiences for business",
        label: "Mission image",
      },
    },
    services: {
      eyebrow: "Services & solutions",
      heading: [
        { text: "Purpose-built platforms for " },
        { text: "every industry", gold: true },
      ],
      lead: "Omid Virtual City has developed a family of specialised platforms for different industries, each shaped around the needs of its own field.",
      items: [
        {
          icon: "showroom",
          title: "3D exhibitions & showrooms",
          description:
            "Digital showrooms for brands and manufacturers, where visitors explore products in a lifelike space, move between models, change colours and materials, and get as close to an in-person visit as the web allows.",
          image: {
            src: "/images/about/service-showroom.webp",
            alt: "A digital 3D showroom",
            label: "3D showroom image",
          },
        },
        {
          icon: "product",
          title: "Interactive product experiences",
          description:
            "Three-dimensional product displays with full rotation, close inspection of details, personalisation and augmented reality preview — everything a customer needs to decide faster.",
          image: {
            src: "/images/about/service-product.webp",
            alt: "Interactive 3D product display",
            label: "Product experience image",
          },
        },
        {
          icon: "realestate",
          title: "Virtual property tours",
          description:
            "Interactive tours of construction projects, residential complexes and individual properties, with 3D views of the spaces themselves and the amenities that surround them.",
          image: {
            src: "/images/about/service-realestate.webp",
            alt: "Virtual tour of a construction project",
            label: "Property tour image",
          },
        },
        {
          icon: "automotive",
          title: "Automotive showrooms",
          description:
            "Digital car showrooms where a vehicle can be examined in full — every detail inspected, colours and materials changed, the whole experience explored well before purchase.",
          image: {
            src: "/images/about/service-automotive.webp",
            alt: "Digital automotive showroom",
            label: "Automotive showroom image",
          },
        },
        {
          icon: "jewelry",
          title: "Gold & jewellery solutions",
          description:
            "Three-dimensional product displays, digital vitrines and interactive experiences built to present gold and jewellery collections at their best.",
          image: {
            src: "/images/about/service-jewelry.webp",
            alt: "Digital jewellery vitrine",
            label: "Jewellery image",
          },
        },
        {
          icon: "tryon",
          title: "Virtual jewellery try-on",
          description:
            "Wear the jewellery and accessories you love before you buy them, using nothing more than your phone's camera.",
          image: {
            src: "/images/about/service-tryon.webp",
            alt: "Virtual jewellery try-on with a phone camera",
            label: "Try-on image",
          },
        },
        {
          icon: "events",
          title: "Event & ticketing systems",
          description:
            "Ticketing platforms with a 3D model of the venue, seat selection based on the real sightline from each seat, and a precise sense of the space before anyone pays.",
          image: {
            src: "/images/about/service-events.webp",
            alt: "3D venue view with seat selection",
            label: "Event & ticketing image",
          },
        },
        {
          icon: "booking",
          title: "Service booking",
          description:
            "Intelligent booking systems for service businesses, combining a 3D view of the space and its services with an interactive, genuinely usable booking experience.",
          image: {
            src: "/images/about/service-booking.webp",
            alt: "Intelligent service booking system",
            label: "Service booking image",
          },
        },
      ],
    },
    vision: {
      eyebrow: "Our vision",
      heading: [
        { text: "One connected ecosystem of " },
        { text: "digital experience", gold: true },
      ],
      paragraphs: [
        "Our vision is a single, unified ecosystem of digital experience — a city where shops, exhibitions, construction projects, service centres, events and businesses are all connected as intelligent 3D environments.",
        "We believe the next generation of the web is not about displaying information; it is about creating experience. Experience that dissolves the boundary between the physical and the digital, and lets people feel and examine a decision before they make it — and make it with far more confidence.",
      ],
      quote:
        "At Omid Virtual City we do not just build 3D environments. We create experiences that help businesses be seen better, present themselves better, and sell more effectively.",
      image: {
        src: "/images/about/vision.webp",
        alt: "The connected ecosystem of the virtual city",
        label: "Vision image",
      },
    },
    footer: {
      note: "Omid Virtual City — where businesses get seen.",
    },
  },
};
