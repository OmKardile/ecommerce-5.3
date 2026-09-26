import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const models = Object.keys(db).filter(k => typeof (db as any)[k]?.count === 'function')
  const out: Record<string, number> = {}
  for (const m of models) {
    try { out[m] = await (db as any)[m].count() } catch { out[m] = -1 }
  }
  console.log(JSON.stringify(out, null, 1))
}
main().finally(() => db.$disconnect())
