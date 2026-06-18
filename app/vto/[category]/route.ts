import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getModelPath, Category } from '../models-config';

const VALID_CATEGORIES = ['earrings', 'necklace', 'rings', 'watch'];

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

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    return new NextResponse('Demo not found', { status: 404 });
  }
}
