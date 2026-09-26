// QA fixtures — one B2B inquiry pair + one wishlist price-drop demo. Cleaned by scripts/qa-clean.ts
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const product = await db.product.findFirstOrThrow({ where: { slug: 'cp-plus-8ch-hd-dvr' }, select: { id: true, name: true } })
  const product2 = await db.product.findFirstOrThrow({ where: { slug: 'optilink-gigabit-fiber-media-converter' }, select: { id: true } })
  await db.b2BInquiry.deleteMany({})
  await db.b2BInquiry.createMany({
    data: [
      {
        name: 'Rakesh Construction', phone: '+919812345678', email: 'rakesh@rakeshcon.in',
        companyName: 'Rakesh Constructions Pvt Ltd', gstin: '24AACCR1234A1Z5',
        message: 'Need 8 units of the CP Plus 8CH DVR + 12 bullet cameras for a warehouse site in Hazira. Please quote contractor price with GST. Delivery within 10 days.',
        productId: product.id, status: 'NEW',
      },
      {
        name: 'Meera Electricals', phone: '+919845612390', email: null,
        companyName: 'Meera Electricals & Networks', gstin: null,
        message: 'Bulk fiber media converters — 25 pcs. Do you offer dealer rates above 20 units?',
        productId: product2.id, status: 'CONTACTED', handledAt: new Date(),
      },
    ],
  })
  // wishlist drop demo: customer + product, snapshot 50000 paise ABOVE current price
  const user = await db.user.findFirstOrThrow({ where: { phone: '+919876543210' }, select: { id: true } })
  const wishlist = await db.wishlist.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  await db.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } })
  await db.wishlistItem.create({ data: { wishlistId: wishlist.id, productId: product.id, priceAtAddPaise: 999900 } })
  console.log('fixture ok: 2 inquiries + wishlist drop demo (snapshot ₹9,990 vs current ₹4,590)')
}
main().finally(() => db.$disconnect())
