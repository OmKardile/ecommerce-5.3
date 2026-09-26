import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const product = await db.product.findFirstOrThrow({ where: { slug: 'cp-plus-8ch-hd-dvr' }, select: { id: true } })
  const skus = await db.sku.findMany({ where: { variant: { productId: product.id } }, select: { code: true, sellingPrice: true } })
  console.log(JSON.stringify(skus))
  const user = await db.user.findFirstOrThrow({ where: { phone: '+919876543210' }, select: { id: true } })
  const wishlist = await db.wishlist.findUniqueOrThrow({ where: { userId: user.id } })
  const min = Math.min(...skus.map(s => s.sellingPrice))
  await db.wishlistItem.updateMany({ where: { wishlistId: wishlist.id, productId: product.id }, data: { priceAtAddPaise: min + 800000 } })
  console.log('min price paise:', min, '-> snapshot:', min + 800000)
}
main().finally(() => db.$disconnect())
