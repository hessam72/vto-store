Get Store by Slug (/api/next-api/get-store-by-slug)
Success Response (200):
{
  "store": {
    "id": 1,
    "shopkeeper_id": 1,
    "gallery_id": 1,
    "is_pending_update": false,
    "status": "active",
    "title": "Store Name",
    "slug": "store-slug",
    "logo": "stores/logo.png",
    "view_count": 100,
    "description": "Store description",
    "created_at": "2024-01-01T00:00:00.000000Z",
    "updated_at": "2024-01-01T00:00:00.000000Z",
    
    "gallery": {
      "id": 1,
      "title": "Gallery Title",
      "description": "Gallery description",
      "status": "active",
      "created_at": "2024-01-01T00:00:00.000000Z",
      "updated_at": "2024-01-01T00:00:00.000000Z",
      
      "threeDFiles": [
        {
          "id": 1,
          "url": "3d-files/scene.glb",
          "created_at": "2024-01-01T00:00:00.000000Z",
          "updated_at": "2024-01-01T00:00:00.000000Z",
          "pivot": {
            "gallery_id": 1,
            "three_d_file_id": 1
          }
        }
      ],
      
      "stages": [
        {
          "id": 1,
          "code": "stage_1",
          "created_at": "2024-01-01T00:00:00.000000Z",
          "updated_at": "2024-01-01T00:00:00.000000Z",
          "pivot": {
            "gallery_id": 1,
            "stage_id": 1
          }
        }
      ]
    },
    
    "files": [
      {
        "id": 1,
        "store_id": 1,
        "url": "store-files/image1.jpg",
        "file_type": "image",
        "priority": 1,
        "quality": "high"
      }
    ],
    
    "products": [
      {
        "id": 1,
        "status": "active",
        "title": "Product Name",
        "weight": 15.5,
        "caliber": 24,
        "construction_fee": 3.0,
        "description": "Product description",
        "store_id": 1,
        "three_d_file_id": 2,
        "stage_id": 1,
        "sales_count": 0,
        "view_count": 0,
        "created_at": "2024-01-01T00:00:00.000000Z",
        "updated_at": "2024-01-01T00:00:00.000000Z",
        
        "stage": {
          "id": 1,
          "code": "stage_1",
          "created_at": "2024-01-01T00:00:00.000000Z",
          "updated_at": "2024-01-01T00:00:00.000000Z"
        },
        
        "threeDFile": {
          "id": 2,
          "url": "3d-files/products/ring.glb",
          "created_at": "2024-01-01T00:00:00.000000Z",
          "updated_at": "2024-01-01T00:00:00.000000Z"
        }
      }
    ]
  }
}
Error Response (404):
{
  "error": "Store not found"
}