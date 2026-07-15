export interface APIThreeDFile {
  id: number
  url: string
  created_at: string
  updated_at: string
  pivot?: {
    gallery_id: number
    three_d_file_id: number
  }
}

export interface APIStage {
  id: number
  code: string
  created_at: string
  updated_at: string
  pivot?: {
    gallery_id: number
    stage_id: number
  }
}

export interface APIGallery {
  id: number
  title: string
  description: string
  status: string
  created_at: string
  updated_at: string
  threeDFiles: APIThreeDFile[]
  stages: APIStage[]
}

export interface APIStoreFile {
  id: number
  store_id: number
  url: string
  file_type: string
  priority: number
  quality: string
}

export interface APIProduct {
  id: number
  status: string
  title: string
  weight: number
  caliber: number
  construction_fee: number
  description: string
  store_id: number
  three_d_file_id: number
  stage_id: number
  sales_count: number
  view_count: number
  created_at: string
  updated_at: string
  stage: APIStage
  threeDFile: APIThreeDFile
}

export interface APIStore {
  id: number
  shopkeeper_id: number
  gallery_id: number
  is_pending_update: boolean
  status: string
  title: string
  slug: string
  logo: string
  view_count: number
  description: string
  created_at: string
  updated_at: string
  gallery: APIGallery
  files: APIStoreFile[]
  products: APIProduct[]
}

export interface GetStoreBySlugResponse {
  store: APIStore
}
