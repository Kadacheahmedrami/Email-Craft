import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/chats/[id]/messages - Add a message to a chat
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role, content, generatedTemplate, metadata } = await req.json()

    // Ensure chat exists and belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    })

    if (!chat) {
      // Create chat if it doesn't exist
      await prisma.chat.create({
        data: {
          id: id,
          userId: session.user.id,
          title: "New Chat",
        },
      })
    }

    const message = await prisma.message.create({
      data: {
        chatId: id,
        role,
        content,
        generatedTemplate,
        metadata,
      },
    })

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
}
