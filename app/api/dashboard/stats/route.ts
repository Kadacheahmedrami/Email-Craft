import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

      if (!prisma) {
        return NextResponse.json({ error: "Database not available" }, { status: 500 })
      }
  

    const userId = session.user.id

    // Get recent chats with message counts
    const recentChats = await prisma.chat.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
            images: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })

    // Get email send statistics
    const emailStats = await prisma.emailSend.groupBy({
      by: ["status"],
      where: { userId },
      _count: {
        status: true,
      },
    })

    // Get recent email sends
    const recentEmailSends = await prisma.emailSend.findMany({
      where: { userId },
      include: {
        chat: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    // Calculate time-based statistics
    const now = new Date()
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const weeklyStats = await prisma.emailSend.count({
      where: {
        userId,
        createdAt: { gte: lastWeek },
      },
    })

    const monthlyStats = await prisma.emailSend.count({
      where: {
        userId,
        createdAt: { gte: lastMonth },
      },
    })

    // Get template usage (most used templates)
    const templateUsage = await prisma.emailSend.groupBy({
      by: ["chatId"],
      where: { userId },
      _count: {
        chatId: true,
      },
      orderBy: {
        _count: {
          chatId: "desc",
        },
      },
      take: 5,
    })

    // Get chat titles for template usage
    const chatIds = templateUsage.map((t) => t.chatId)
    const chatsForTemplates = await prisma.chat.findMany({
      where: {
        id: { in: chatIds },
      },
      select: {
        id: true,
        title: true,
      },
    })

    const templateUsageWithTitles = templateUsage.map((usage) => {
      const chat = chatsForTemplates.find((c) => c.id === usage.chatId)
      return {
        chatId: usage.chatId,
        chatTitle: chat?.title || "Unknown Chat",
        usageCount: usage._count.chatId,
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        recentChats: recentChats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          updatedAt: chat.updatedAt,
          messageCount: chat._count.messages,
          imageCount: chat._count.images,
          lastMessage: chat.messages[0] || null,
          hasTemplate: !!chat.currentTemplate,
        })),
        emailStats: {
          total: emailStats.reduce((sum, stat) => sum + stat._count.status, 0),
          sent: emailStats.find((s) => s.status === "SENT")?._count.status || 0,
          failed: emailStats.find((s) => s.status === "FAILED")?._count.status || 0,
          pending: emailStats.find((s) => s.status === "PENDING")?._count.status || 0,
          weeklyCount: weeklyStats,
          monthlyCount: monthlyStats,
        },
        recentEmailSends: recentEmailSends.map((send) => ({
          id: send.id,
          subject: send.subject,
          status: send.status,
          recipientCount: Array.isArray(send.recipients) ? send.recipients.length : 0,
          createdAt: send.createdAt,
          sentAt: send.sentAt,
          chatTitle: send.chat.title,
        })),
        templateUsage: templateUsageWithTitles,
      },
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 })
  }
}
