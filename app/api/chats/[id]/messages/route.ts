import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/chats/[id]/messages - Get messages for a chat
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

    const messages = await prisma.message.findMany({
      where: {
        chatId: params.id,
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      success: true,
      messages,
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// POST /api/chats/[id]/messages - Add a new message to a chat
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  

    const { role, content, generatedTemplate, metadata } = await req.json()

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

    const message = await prisma.message.create({
      data: {
        chatId: params.id,
        role,
        content,
        generatedTemplate,
        metadata: metadata || {},
      },
    })

    // Update chat's current template if this message has one
    if (generatedTemplate) {
      await prisma.chat.update({
        where: { id: params.id },
        data: { currentTemplate: generatedTemplate },
      })
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
}
