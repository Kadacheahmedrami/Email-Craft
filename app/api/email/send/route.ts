import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions, getUserTokens } from "@/lib/auth"
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
  senderName?: string
  recipients: EmailRecipient[]
  replyTo?: string
  template: string
  attachments?: EmailAttachment[]
}

// Create Gmail API client
const createGmailClient = (accessToken: string) => {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  return google.gmail({ version: "v1", auth: oauth2Client })
}

// Test Gmail API access
const testGmailAccess = async (accessToken: string) => {
  try {
    const gmail = createGmailClient(accessToken)
    const profile = await gmail.users.getProfile({ userId: 'me' })
    return { success: true, email: profile.data.emailAddress }
  } catch (error: any) {
    return { success: false, error }
  }
}

// Convert HTML to plain text
const htmlToPlainText = (html: string): string => {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Create HTML email
const createHtmlEmail = (
  to: string[],
  subject: string,
  htmlBody: string,
  fromName: string,
  fromEmail: string,
  replyTo?: string,
): string => {
  const emailParts = [
    `To: ${to.join(", ")}`,
    `From: ${fromName} <${fromEmail}>`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody
  ].filter(Boolean)

  return Buffer.from(emailParts.join("\r\n"), 'utf8')
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// Process HTML for email compatibility
const processHtmlForEmail = (html: string): string => {
  if (!html.trim().toLowerCase().startsWith('<!doctype') && 
      !html.trim().toLowerCase().startsWith('<html')) {
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title></title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${html}
</body>
</html>`
  }
  return html
}

// Inline CSS and optimize for email clients
const optimizeHtmlForEmail = (html: string): string => {
  try {
    let optimizedHtml = juice(html, {
      removeStyleTags: true,
      preserveMediaQueries: false,
      preserveFontFaces: false,
      preserveKeyFrames: false,
      preserveImportant: true,
      preservePseudos: false,
      inlinePseudoElements: false,
      webResources: {
        images: false,
        links: false,
        scripts: false
      },
      xmlMode: false,
      applyAttributesTableElements: true,
      insertPreservedExtraCss: false
    })

    // Email client compatibility fixes
    return optimizedHtml
      .replace(/<table(?![^>]*cellpadding)/g, '<table cellpadding="0" cellspacing="0" border="0"')
      .replace(/<img([^>]*?)>/g, '<img$1 style="display:block; border:0; outline:none; text-decoration:none;">')
      .replace(/line-height:\s*(\d+(?:\.\d+)?);/g, 'line-height:$1; mso-line-height-rule:exactly;')
      .replace(/box-shadow:[^;]+;/g, '')
      .replace(/text-shadow:[^;]+;/g, '')
      .replace(/transform:[^;]+;/g, '')
  } catch {
    return html
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
    if (!data.subject || !data.template || !data.chatId) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields",
        details: "Subject, template, and chat ID are required",
      }, { status: 400 })
    }

    // Parallel validation: chat ownership and recipients
    const [chat, validRecipients] = await Promise.all([
      prisma.chat.findFirst({
        where: { id: data.chatId, userId: session.user.id },
      }),
      Promise.resolve(data.recipients?.filter(r => r.email?.includes("@") && r.email?.includes(".")) || [])
    ])

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    if (validRecipients.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No valid recipient emails provided",
      }, { status: 400 })
    }

    const senderEmail = session.user.email
    const senderName = data.senderName || session.user.name || "User"

    if (!senderEmail) {
      return NextResponse.json({
        success: false,
        error: "User email not found",
        code: "MISSING_SENDER_EMAIL",
      }, { status: 400 })
    }

    // Get tokens and test Gmail access in parallel
    const [tokens, emailSend] = await Promise.all([
      getUserTokens(session.user.id),
      prisma.emailSend.create({
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
    ])

    if (!tokens) {
      return NextResponse.json({
        success: false,
        error: "Google account authentication failed",
        details: "Please sign in with Google again to send emails",
        code: "AUTH_REQUIRED",
      }, { status: 401 })
    }

    // Test Gmail access
    const gmailTest = await testGmailAccess(tokens.accessToken)
    if (!gmailTest.success) {
      const errorCode = gmailTest.error?.code
      
      if (errorCode === 401 || gmailTest.error?.message?.includes("invalid_grant")) {
        return NextResponse.json({
          success: false,
          error: "Authentication failed",
          details: "Please re-authenticate with Google to send emails",
          code: "AUTH_EXPIRED",
        }, { status: 401 })
      }

      if (errorCode === 403) {
        return NextResponse.json({
          success: false,
          error: "Permission denied",
          details: "Gmail API access denied. Please check your Google account permissions.",
          code: "PERMISSION_DENIED",
        }, { status: 403 })
      }

      return NextResponse.json({
        success: false,
        error: "Gmail API access failed",
        details: gmailTest.error?.message || "Unknown error",
        code: "GMAIL_API_ERROR",
      }, { status: 500 })
    }

    try {
      // Process HTML for email
      const processedHtml = processHtmlForEmail(data.template)
      const finalHtml = optimizeHtmlForEmail(processedHtml)

      // Create email message
      const emailMessage = createHtmlEmail(
        validRecipients.map(r => r.email),
        data.subject,
        finalHtml,
        senderName,
        senderEmail,
        data.replyTo,
      )

      // Send email
      const gmail = createGmailClient(tokens.accessToken)
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: emailMessage },
      })

      // Update status
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          metadata: {
            messageId: response.data.id,
            threadId: response.data.threadId,
            service: "Gmail API",
            htmlProcessed: true,
          } as unknown as Prisma.InputJsonValue,
        },
      })

      return NextResponse.json({
        success: true,
        emailSendId: emailSend.id,
        messageId: response.data.id,
        threadId: response.data.threadId,
        recipients: validRecipients.length,
        timestamp: new Date().toISOString(),
      })

    } catch (sendError: any) {
      // Update failed status
      await prisma.emailSend.update({
        where: { id: emailSend.id },
        data: {
          status: "FAILED",
          errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
        },
      })

      const errorCode = sendError.code
      
      if (errorCode === 401 || sendError.message?.includes("invalid_grant")) {
        return NextResponse.json({
          success: false,
          error: "Authentication failed",
          code: "AUTH_EXPIRED",
        }, { status: 401 })
      }

      if (errorCode === 403) {
        return NextResponse.json({
          success: false,
          error: "Permission denied",
          code: "PERMISSION_DENIED",
        }, { status: 403 })
      }

      if (errorCode === 429) {
        return NextResponse.json({
          success: false,
          error: "Rate limit exceeded",
          code: "RATE_LIMIT",
        }, { status: 429 })
      }

      throw sendError
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to send email",
      details: error instanceof Error ? error.message : String(error),
      code: "SEND_FAILED",
    }, { status: 500 })
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

    const emailSends = await prisma.emailSend.findMany({
      where: {
        userId: session.user.id,
        ...(chatId && { chatId }),
      },
      include: {
        chat: {
          select: { title: true },
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
    return NextResponse.json({ error: "Failed to fetch email sends" }, { status: 500 })
  }
}