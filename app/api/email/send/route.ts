import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions, getUserTokens, debugUserTokens } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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
  senderName?: string // Optional - will default to user's name
  recipients: EmailRecipient[]
  replyTo?: string
  template: string
  attachments?: EmailAttachment[]
}

// Create Gmail API client
function createGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  return google.gmail({ version: "v1", auth: oauth2Client })
}

// Test Gmail API access
async function testGmailAccess(accessToken: string) {
  try {
    const gmail = createGmailClient(accessToken)
    const profile = await gmail.users.getProfile({ userId: 'me' })
    console.log("✅ Gmail API access successful:", profile.data.emailAddress)
    return { success: true, email: profile.data.emailAddress }
  } catch (error: any) {
    console.error("❌ Gmail API access failed:", {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details
    })
    return { success: false, error }
  }
}

// Convert HTML to base64 encoded email
function createEmailMessage(
  to: string[],
  subject: string,
  htmlBody: string,
  fromName: string,
  fromEmail: string,
  replyTo?: string,
): string {
  const boundary = "boundary_" + Math.random().toString(36).substr(2, 9)

  const email = [
    `To: ${to.join(", ")}`,
    `From: ${fromName} <${fromEmail}>`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
  ]
    .filter((line) => line !== "")
    .join("\r\n")

  // Convert to base64url
  return Buffer.from(email).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data: SendEmailRequest = await req.json()

    // Validate required fields
    if (!data.subject || !data.template || !data.chatId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          details: "Subject, template, and chat ID are required",
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

    // Get the authenticated user's email - this will be the sender
    const senderEmail = session.user.email
    const senderName = data.senderName || session.user.name || "User"

    if (!senderEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "User email not found",
          details: "Cannot send email without authenticated user email",
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

    console.log("🔍 Starting email send process...")
    console.log("Processing email send request:", {
      subject: data.subject,
      recipients: validRecipients.length,
      attachments: data.attachments?.length || 0,
      chatId: data.chatId,
      senderEmail: senderEmail,
    })

    // Debug user tokens and scopes
    console.log("🔍 Debugging user tokens...")
    await debugUserTokens(session.user.id)

    // Get fresh tokens using the improved token management
    console.log("🔍 Getting fresh tokens...")
    const tokens = await getUserTokens(session.user.id)

    if (!tokens) {
      console.log("❌ No tokens available")
      return NextResponse.json(
        {
          success: false,
          error: "Google account authentication failed",
          details: "Please sign in with Google again to send emails",
          code: "AUTH_REQUIRED",
        },
        { status: 401 },
      )
    }

    console.log("✅ Tokens obtained successfully")

    // Test Gmail API access before proceeding
    console.log("🔍 Testing Gmail API access...")
    const gmailTest = await testGmailAccess(tokens.accessToken)
    
    if (!gmailTest.success) {
      console.log("❌ Gmail API test failed")
      
      // Handle specific error codes
      if (gmailTest.error?.code === 401 || gmailTest.error?.message?.includes("invalid_grant")) {
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

      if (gmailTest.error?.code === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "Permission denied",
            details: "Gmail API access denied. Please check your Google account permissions and ensure you've granted Gmail send permissions.",
            code: "PERMISSION_DENIED",
            debugInfo: {
              errorCode: gmailTest.error.code,
              errorMessage: gmailTest.error.message,
              suggestion: "Try signing out and signing back in to grant Gmail permissions"
            }
          },
          { status: 403 },
        )
      }

      // Generic error
      return NextResponse.json(
        {
          success: false,
          error: "Gmail API access failed",
          details: gmailTest.error?.message || "Unknown error",
          code: "GMAIL_API_ERROR",
        },
        { status: 500 },
      )
    }

    console.log("✅ Gmail API access confirmed")

    // Create email send record
    const emailSend = await prisma.emailSend.create({
      data: {
        chatId: data.chatId,
        userId: session.user.id,
        subject: data.subject,
        senderName: senderName,
        senderEmail: senderEmail,
        recipients: validRecipients as unknown as Prisma.InputJsonValue,
        templateHtml: data.template,
        attachments: (data.attachments || []) as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    })

    try {
      console.log("🔍 Processing email template...")
      // Inline CSS styles using Juice
      let inlinedHtml: string
      try {
        inlinedHtml = juice(data.template, {
          removeStyleTags: true,
          preserveMediaQueries: true,
          preserveFontFaces: true,
        })
      } catch (juiceError) {
        console.error("Error inlining CSS:", juiceError)
        inlinedHtml = data.template
      }

      // Create Gmail client with fresh access token
      const gmail = createGmailClient(tokens.accessToken)

      // Prepare recipient emails
      const recipientEmails = validRecipients.map((r) => r.email)

      // Create email message
      console.log("🔍 Creating email message...")
      const emailMessage = createEmailMessage(
        recipientEmails,
        data.subject,
        inlinedHtml,
        senderName,
        senderEmail,
        data.replyTo,
      )

      // Send email using Gmail API
      console.log("🔍 Sending email via Gmail API...")
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: emailMessage,
        },
      })

      // Update email send record as successful
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          metadata: {
            messageId: response.data.id,
            threadId: response.data.threadId,
            service: "Gmail API",
          } as unknown as Prisma.InputJsonValue,
        },
      })

      console.log("✅ Email sent successfully:", {
        messageId: response.data.id,
        recipients: validRecipients.length,
        threadId: response.data.threadId,
      })

      return NextResponse.json({
        success: true,
        emailSendId: emailSend.id,
        messageId: response.data.id,
        threadId: response.data.threadId,
        recipients: validRecipients.length,
        timestamp: new Date().toISOString(),
        details: {
          service: "Gmail API",
          sentFrom: senderEmail,
        },
      })

    } catch (sendError: any) {
      console.error("❌ Email send failed:", {
        code: sendError.code,
        message: sendError.message,
        status: sendError.status,
        details: sendError.details,
        errors: sendError.errors
      })

      // Update email send record as failed
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: "FAILED",
          errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
        },
      })

      // Handle specific Gmail API errors
      if (sendError.code === 401 || sendError.message?.includes("invalid_grant")) {
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

      if (sendError.code === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "Permission denied",
            details: "Gmail API access may be restricted. Please check your Google account permissions.",
            code: "PERMISSION_DENIED",
            debugInfo: {
              errorCode: sendError.code,
              errorMessage: sendError.message,
              suggestion: "Try signing out and signing back in to grant Gmail send permissions"
            }
          },
          { status: 403 },
        )
      }

      if (sendError.code === 429) {
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

      throw sendError
    }

  } catch (error) {
    console.error("❌ Error sending email:", error)

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