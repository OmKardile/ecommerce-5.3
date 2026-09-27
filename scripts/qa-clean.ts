// Removes QA junk + demo fixtures before go-live:
//  - the mistyped +919198765432 user created during browser QA
//  - the 2 demo B2B trade-desk inquiries (qa-fixtures.ts)
//  - the wishlist price-drop demo row (qa-fixtures.ts)
//  - the pending moderation-queue demo review (qa-fixtures.ts)
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const junk = await db.user.findFirst({ where: { phone: '+919198765432' } })
  if (junk) { await db.user.delete({ where: { id: junk.id } }); console.log('deleted junk user', junk.id) } else console.log('no junk user')

  const inq = await db.b2BInquiry.deleteMany({})
  console.log('purged demo inquiries:', inq.count)

  const user = await db.user.findFirst({ where: { phone: '+919876543210' }, select: { id: true } })
  if (user) {
    const items = await db.wishlistItem.deleteMany({ where: { wishlist: { userId: user.id } } })
    console.log('purged demo wishlist items:', items.count)
    const rev = await db.review.deleteMany({ where: { userId: user.id, isApproved: false } })
    console.log('purged demo pending reviews:', rev.count)
  } else {
    console.log('no test customer')
  }
}
main().finally(() => db.$disconnect())
