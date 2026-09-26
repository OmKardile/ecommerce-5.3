// Removes QA junk: the mistyped +919198765432 user created during browser QA.
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const junk = await db.user.findFirst({ where: { phone: '+919198765432' } })
  if (junk) { await db.user.delete({ where: { id: junk.id } }); console.log('deleted junk user', junk.id) } else console.log('no junk user')
}
main().finally(() => db.$disconnect())
