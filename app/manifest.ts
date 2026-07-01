import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'لومینا - پاساژ دیجیتال شهر امید',
    short_name: 'لومینا',
    description: 'نمایشگاه سه‌بعدی و امتحان مجازی جواهرات',
    start_url: '/',
    display: 'standalone',
    background_color: '#060608',
    theme_color: '#060608',
    icons: [
      {
        src: '/images/pwa-logo.jpeg',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
