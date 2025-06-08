import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/chats - Get all chats for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }



    const chats = await prisma.chat.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        images: {
          select: {
            id: true,
            filename: true,
          },
        },
        _count: {
          select: {
            messages: true,
            images: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        currentTemplate: chat.currentTemplate,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessage: chat.messages[0] || null,
        imageCount: chat._count.images,
        messageCount: chat._count.messages,
      })),
    })
  } catch (error) {
    console.error("Error fetching chats:", error)
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 })
  }
}

// POST /api/chats - Create a new chat
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title } = await req.json()

 

    const chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: title || "New Chat",
      },
    })

    return NextResponse.json({
      success: true,
      chat,
    })
  } catch (error) {
    console.error("Error creating chat:", error)
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 })
  }
}