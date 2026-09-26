import { ok, fail } from '@/lib/api-helpers';
import { getProductBySlug, getRelatedProducts } from '@/server/services/catalog.service';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return fail('Product not found', 404);
  const related = await getRelatedProducts(product.id, product.categoryId);
  return ok({ product, related });
}
