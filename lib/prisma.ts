import { PrismaClient } from "@prisma/client"

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  } catch (error) {
    console.error("Failed to create Prisma client:", error)
    throw error // Re-throw to fail fast
  }
}

// Singleton pattern for development hot reload protection
export const prisma = (() => {
  if (process.env.NODE_ENV === "production") {
    return createPrismaClient()
  }

  if (!global.__prisma) {
    global.__prisma = createPrismaClient()
  }

  return global.__prisma
})()

// Graceful shutdown
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect()
  })
}