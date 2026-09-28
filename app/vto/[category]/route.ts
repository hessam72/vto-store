import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getModelPath, Category } from '../models-config';

const VALID_CATEGORIES = ['earrings', 'necklace', 'rings', 'watch', 'glasses'];

// Load products data
let productsData: Record<string, any> | null = null;

async function loadProducts() {
  if (!productsData) {
    const productsPath = join(process.cwd(), 'public', 'config', 'products.json');
    const content = await readFile(productsPath, 'utf-8');
    productsData = JSON.parse(content);
  }
  return productsData;
}

function getDefaultProductData(category: string) {
  const defaults: Record<string, any> = {
    earrings: { name: 'گوشواره', price: null, weight: null },
    necklace: { name: 'گردنبند', price: null, weight: null },
    rings: { name: 'انگشتر', price: null, weight: null },
    watch: { name: 'ساعت', price: null, weight: null },
    glasses: { name: 'عینک', price: null, weight: null }
  };
  return defaults[category] || { name: 'محصول', price: null, weight: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;

  if (!VALID_CATEGORIES.includes(category)) {
    return new NextResponse('Category not found', { status: 404 });
  }

  try {
    const htmlPath = join(process.cwd(), 'public', 'vto', category, 'index.html');
    let htmlContent = await readFile(htmlPath, 'utf-8');

    // Parse URL param for model selection
    const modelName = request.nextUrl.searchParams.get('model') || undefined;
    const modelPath = getModelPath(category as Category, modelName);

    if (modelName && !modelPath) {
      return new NextResponse('Invalid model name', { status: 400 });
    }

    // Inject base tag for relative paths
    const baseTag = `<base href="/vto/${category}/">`;
    htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`);

    // Inject model URL if available
    if (modelPath) {
      const modelScript = `<script>window.VTO_MODEL_URL="${modelPath}";</script>`;
      htmlContent = htmlContent.replace('</head>', `    ${modelScript}\n  </head>`);
    }

    // Inject product data (from model or default)
    let productDataToInject;

    if (modelName) {
      const products = await loadProducts();
      const productData = products?.[modelName];

      if (productData) {
        productDataToInject = {
          name: productData.name_fa,
          price: productData.price,
          weight: productData.weight
        };
      } else {
        productDataToInject = getDefaultProductData(category);
      }
    } else {
      productDataToInject = getDefaultProductData(category);
    }

    const productScript = `<script>window.VTO_PRODUCT_DATA=${JSON.stringify(productDataToInject)};</script>`;
    htmlContent = htmlContent.replace('</head>', `    ${productScript}\n  </head>`);

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    return new NextResponse('Demo not found', { status: 404 });
  }
}
