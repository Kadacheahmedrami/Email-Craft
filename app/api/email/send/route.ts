import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import nodemailer from "nodemailer"
import { google } from "googleapis"
import juice from "juice"
import type { Prisma } from "@prisma/client"

interface EmailRecipient {
  email: string
  name?: string
}

interface EmailAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
}

interface SendEmailRequest {
  chatId: string
  subject: string
  senderName: string
  senderEmail: string
  recipients: EmailRecipient[]
  replyTo?: string
  template: string
  attachments?: EmailAttachment[]
}

// OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

async function createTransporter(accessToken: string) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: undefined,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        accessToken: accessToken,
      },
    } as any)

    return transporter
  } catch (error) {
    console.error("Error creating transporter:", error)
    throw new Error("Failed to create email transporter")
  }
}

async function downloadAttachment(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error("Error downloading attachment:", error)
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data: SendEmailRequest = await req.json()

    // Validate required fields
    if (!data.subject || !data.senderEmail || !data.template || !data.chatId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          details: "Subject, sender email, template, and chat ID are required",
        },
        { status: 400 },
      )
    }

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: data.chatId,
        userId: session.user.id,
      },
    })

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    if (!data.recipients || data.recipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one recipient is required",
        },
        { status: 400 },
      )
    }

    // Validate recipients
    const validRecipients = data.recipients.filter((r) => r.email && r.email.includes("@") && r.email.includes("."))

    if (validRecipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid recipient emails provided",
        },
        { status: 400 },
      )
    }

    // Get user's Google account for sending
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
    })

    if (!account?.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Google account not connected",
          details: "Please sign in with Google to send emails",
        },
        { status: 401 },
      )
    }

    console.log("Processing email send request:", {
      subject: data.subject,
      recipients: validRecipients.length,
      attachments: data.attachments?.length || 0,
      chatId: data.chatId,
    })

    // Create email send record
    const emailSend = await prisma.emailSend.create({
      data: {
        chatId: data.chatId,
        userId: session.user.id,
        subject: data.subject,
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        recipients: validRecipients as unknown as Prisma.InputJsonValue,
        templateHtml: data.template,
        attachments: (data.attachments || []) as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    })

    try {
      // Inline CSS styles using Juice
      let inlinedHtml: string
      try {
        inlinedHtml = juice(data.template, {
          removeStyleTags: true,
          preserveMediaQueries: true,
          preserveFontFaces: true,
          webResources: {
            relativeTo: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          },
        })
      } catch (juiceError) {
        console.error("Error inlining CSS:", juiceError)
        inlinedHtml = data.template
      }

      // Create transporter with user's access token
      const transporter = await createTransporter(account.access_token)

      // Process attachments
      const attachments: any[] = []
      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          try {
            const buffer = await downloadAttachment(attachment.url)
            attachments.push({
              filename: attachment.name,
              content: buffer,
              contentType: attachment.type,
              size: attachment.size,
            })
          } catch (attachmentError) {
            console.error(`Failed to process attachment ${attachment.name}:`, attachmentError)
          }
        }
      }

      // Prepare email options
      const mailOptions = {
        from: `${data.senderName} <${data.senderEmail}>`,
        to: validRecipients.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
        subject: data.subject,
        html: inlinedHtml,
        replyTo: data.replyTo || data.senderEmail,
        attachments: attachments.length > 0 ? attachments : undefined,
        headers: {
          "X-Mailer": "EmailCraft",
          "X-Priority": "3",
          "X-MSMail-Priority": "Normal",
        },
      }

      // Send email
      const info = await transporter.sendMail(mailOptions)

      // Update email send record as successful
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          metadata: {
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
          } as unknown as Prisma.InputJsonValue,
        },
      })

      console.log("Email sent successfully:", {
        messageId: info.messageId,
        recipients: validRecipients.length,
        attachments: attachments.length,
      })

      return NextResponse.json({
        success: true,
        emailSendId: emailSend.id,
        messageId: info.messageId,
        recipients: validRecipients.length,
        attachments: attachments.length,
        timestamp: new Date().toISOString(),
        details: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      })
    } catch (sendError) {
      // Update email send record as failed
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: "FAILED",
          errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
        },
      })

      throw sendError
    }
  } catch (error) {
    console.error("Error sending email:", error)

    // Handle specific OAuth2 errors
    if (error instanceof Error) {
      if (error.message.includes("invalid_grant") || error.message.includes("refresh_token")) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication failed",
            details: "Please re-authenticate with Google to send emails",
            code: "AUTH_EXPIRED",
          },
          { status: 401 },
        )
      }

      if (error.message.includes("quota") || error.message.includes("rate limit")) {
        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded",
            details: "Too many emails sent. Please try again later",
            code: "RATE_LIMIT",
          },
          { status: 429 },
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email",
        details: error instanceof Error ? error.message : String(error),
        code: "SEND_FAILED",
      },
      { status: 500 },
    )
  }
}

// GET /api/email/send - Get email send history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get("chatId")

    const where = {
      userId: session.user.id,
      ...(chatId && { chatId }),
    }

    const emailSends = await prisma.emailSend.findMany({
      where,
      include: {
        chat: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      emailSends,
    })
  } catch (error) {
    console.error("Error fetching email sends:", error)
    return NextResponse.json({ error: "Failed to fetch email sends" }, { status: 500 })
  }
}