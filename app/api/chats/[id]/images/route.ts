import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/chats/[id]/images - Get images for a specific chat
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const images = await prisma.image.findMany({
      where: {
        chatId: params.id,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      images,
    })
  } catch (error) {
    console.error("Error fetching chat images:", error)
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 })
  }
}
