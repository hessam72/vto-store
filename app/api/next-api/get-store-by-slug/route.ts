import { NextRequest, NextResponse } from 'next/server'
import type { GetStoreBySlugResponse } from '@/types/api'

// Mock data transformer
function getMockStoreData(slug?: string | null): GetStoreBySlugResponse {
  // Static data from JSON files
  const storeFiles = [
    { priority: 0, quality: 'low', url: '/store-models/Jewerly Mall wireframe lowp compact (2).glb' },
    { priority: 1, quality: 'high', url: '/store-models/main.glb' }
  ]

  const productsData = {
    'earring-gold': { category: 'earrings', variant: 'default', price: '2,500,000', weight: '3.2', name_fa: 'گوشواره طلا', glbPath: '/models/earrings/default.glb' },
    'necklace-gold': { category: 'necklace', variant: 'native-american', price: '4,900,000', weight: '12.0', name_fa: 'گردنبند طلا ', glbPath: '/models/necklace/native-american.glb' },
    'watch-sport': { category: 'watch', variant: 'default', price: '6,500,000', weight: '95.0', name_fa: 'ساعت ورزشی', glbPath: '/models/watch/default.glb' },
    'Box': { category: 'earrings', variant: 'default', price: '2,500,000', weight: '3.2', name_fa: 'گوشواره طلا', glbPath: '/models/earrings/default.glb' },
    'earring-silver': { category: 'earrings', variant: 'default', price: '1,800,000', weight: '2.8', name_fa: 'گوشواره نقره', glbPath: '/models/earrings/default.glb' },
    'necklace-black-panther': { category: 'necklace', variant: 'black-panther', price: '4,200,000', weight: '15.5', name_fa: 'گردنبند پلنگ سیاه', glbPath: '/models/necklace/black-panther.glb' },
    'necklace-native-american': { category: 'necklace', variant: 'native-american', price: '3,900,000', weight: '12.0', name_fa: 'گردنبند بومی آمریکایی', glbPath: '/models/necklace/native-american.glb' },
    'ring-diamond': { category: 'rings', variant: 'default', price: '5,500,000', weight: '4.5', name_fa: 'انگشتر الماس', glbPath: '/models/rings/default.glb' },
    'ring-gold': { category: 'rings', variant: 'default', price: '3,200,000', weight: '5.0', name_fa: 'انگشتر طلا', glbPath: '/models/rings/default.glb' },
    'watch-luxury': { category: 'watch', variant: 'default', price: '8,900,000', weight: '120.0', name_fa: 'ساعت لوکس', glbPath: '/models/watch/default.glb' }
  }

  // Transform to API structure
  return {
    store: {
      id: 1,
      shopkeeper_id: 1,
      gallery_id: 1,
      is_pending_update: false,
      status: 'active',
      title: 'Default Jewelry Store',
      slug: slug || 'default-store',
      logo: '/images/Lumina-full.png',
      view_count: 100,
      description: 'Premium jewelry collection',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      gallery: {
        id: 1,
        title: 'Main Gallery',
        description: 'Main store gallery',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),

        threeDFiles: storeFiles.map((file, idx) => ({
          id: idx + 1,
          url: file.url,
          priority: file.priority,
          quality: file.quality as 'low' | 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          pivot: {
            gallery_id: 1,
            three_d_file_id: idx + 1
          }
        })),

        stages: [
          { id: 1, code: 'earrings', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), pivot: { gallery_id: 1, stage_id: 1 } },
          { id: 2, code: 'necklace', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), pivot: { gallery_id: 1, stage_id: 2 } },
          { id: 3, code: 'rings', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), pivot: { gallery_id: 1, stage_id: 3 } },
          { id: 4, code: 'watch', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), pivot: { gallery_id: 1, stage_id: 4 } }
        ]
      },

      files: [],

      products: Object.entries(productsData).map(([key, product], idx) => {
        const stageId = product.category === 'earrings' ? 1 : product.category === 'necklace' ? 2 : product.category === 'rings' ? 3 : 4

        return {
          id: idx + 1,
          status: 'active',
          title: product.name_fa,
          weight: parseFloat(product.weight),
          caliber: 24,
          construction_fee: parseFloat(product.price.replace(/,/g, '')),
          description: `${product.name_fa} - ${product.variant}`,
          store_id: 1,
          three_d_file_id: idx + 100,
          stage_id: stageId,
          sales_count: 0,
          view_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),

          stage: {
            id: stageId,
            code: product.category,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },

          threeDFile: {
            id: idx + 100,
            url: product.glbPath,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      })
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  try {
    const data = getMockStoreData(slug)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Store not found' },
      { status: 404 }
    )
  }
}
