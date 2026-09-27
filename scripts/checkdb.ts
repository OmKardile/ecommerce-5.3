import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const [products, users, inquiries, orders] = await Promise.all([
    db.product.count(), db.user.count(), db.b2BInquiry.count(), db.order.count(),
  ])
  console.log({ products, users, inquiries, orders })
}
main().finally(() => db.$disconnect())
