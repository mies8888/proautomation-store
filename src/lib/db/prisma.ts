import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const dbPath = dbUrl.startsWith('file:') ? dbUrl.slice(5) : dbUrl
  const sqlite = new Database(dbPath)
  const adapter = new PrismaBetterSqlite3(sqlite as any)
  return new PrismaClient({ 
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
