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

// Convert HTML to plain text for email fallback
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/<\/p>/gi, '\n\n') // Convert </p> to double newlines
    .replace(/<\/div>/gi, '\n') // Convert </div> to newlines
    .replace(/<\/h[1-6]>/gi, '\n\n') // Convert heading closings to double newlines
    .replace(/<li[^>]*>/gi, '• ') // Convert <li> to bullet points
    .replace(/<\/li>/gi, '\n') // Convert </li> to newlines
    .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
    .replace(/&nbsp;/g, ' ') // Convert &nbsp; to spaces
    .replace(/&amp;/g, '&') // Convert &amp; to &
    .replace(/&lt;/g, '<') // Convert &lt; to <
    .replace(/&gt;/g, '>') // Convert &gt; to >
    .replace(/&quot;/g, '"') // Convert &quot; to "
    .replace(/&#39;/g, "'") // Convert &#39; to '
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s+/g, '\n') // Remove spaces after newlines
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2
    .trim()
}

// Create simple HTML email (often more reliable than multipart)
function createSimpleHtmlEmail(
  to: string[],
  subject: string,
  htmlBody: string,
  fromName: string,
  fromEmail: string,
  replyTo?: string,
): string {
  // Build simple HTML email without multipart
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
  ].filter(line => line !== null && line !== undefined && line !== "")

  const rawEmail = emailParts.join("\r\n")

  // Convert to base64url for Gmail API
  return Buffer.from(rawEmail, 'utf8')
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// Create multipart email message (alternative approach)
function createMultipartEmail(
  to: string[],
  subject: string,
  htmlBody: string,
  fromName: string,
  fromEmail: string,
  replyTo?: string,
): string {
  const boundary = "boundary_" + Math.random().toString(36).substr(2, 9)
  const plainTextBody = htmlToPlainText(htmlBody)

  const emailParts = [
    `To: ${to.join(", ")}`,
    `From: ${fromName} <${fromEmail}>`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    plainTextBody,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    `--${boundary}--`
  ].filter(line => line !== null && line !== undefined && line !== "")

  const rawEmail = emailParts.join("\r\n")

  return Buffer.from(rawEmail, 'utf8')
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// Process HTML template for email compatibility
function processHtmlForEmail(html: string): string {
  let processedHtml = html

  // If it's not a complete HTML document, wrap it properly
  if (!processedHtml.trim().toLowerCase().startsWith('<!doctype') && 
      !processedHtml.trim().toLowerCase().startsWith('<html')) {
    processedHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title></title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${html}
</body>
</html>`
  }

  return processedHtml
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
      console.log("🔍 Processing HTML email template like Nodemailer + Juice...")
      
      // Step 1: Process the HTML template for email compatibility
      let emailReadyHtml = processHtmlForEmail(data.template)
      
      // Step 2: Inline CSS using Juice (exactly like Nodemailer does)
      let finalHtml: string
      try {
        finalHtml = juice(emailReadyHtml, {
          removeStyleTags: true, // Remove style tags after inlining
          preserveMediaQueries: false, // Most email clients don't support media queries
          preserveFontFaces: false, // Limited support in email clients
          preserveKeyFrames: false, // Not supported in email clients
          preserveImportant: true, // Keep !important declarations
          preservePseudos: false, // Email clients don't support pseudo selectors
          inlinePseudoElements: false, // Not supported in email clients
          webResources: {
            images: false, // Don't fetch/inline images
            links: false,  // Don't fetch external stylesheets
            scripts: false // Don't fetch/inline scripts
          },
          xmlMode: false,
          applyAttributesTableElements: true,
          insertPreservedExtraCss: false // Don't insert extra CSS
        })
        
        console.log("✅ CSS inlined successfully with Juice")
        
      } catch (juiceError) {
        console.error("❌ Error inlining CSS with Juice:", juiceError)
        // Fallback to the processed HTML without CSS inlining
        finalHtml = emailReadyHtml
      }

      // Additional email client compatibility fixes
      finalHtml = finalHtml
        // Ensure tables have proper attributes for Outlook
        .replace(/<table(?![^>]*cellpadding)/g, '<table cellpadding="0" cellspacing="0" border="0"')
        // Fix images for better email client support
        .replace(/<img([^>]*?)>/g, '<img$1 style="display:block; border:0; outline:none; text-decoration:none;">')
        // Fix line heights for Outlook
        .replace(/line-height:\s*(\d+(?:\.\d+)?);/g, 'line-height:$1; mso-line-height-rule:exactly;')
        // Remove any remaining problematic CSS
        .replace(/box-shadow:[^;]+;/g, '')
        .replace(/text-shadow:[^;]+;/g, '')
        .replace(/transform:[^;]+;/g, '')

      // Create Gmail client with fresh access token
      const gmail = createGmailClient(tokens.accessToken)

      // Prepare recipient emails
      const recipientEmails = validRecipients.map((r) => r.email)

      console.log("🔍 Creating email message...")
      
      // Use simple HTML email approach (more reliable)
      const emailMessage = createSimpleHtmlEmail(
        recipientEmails,
        data.subject,
        finalHtml,
        senderName,
        senderEmail,
        data.replyTo,
      )

      // Debug: Log the actual email content (first 500 chars)
      const debugEmail = Buffer.from(emailMessage, 'base64').toString('utf8')
      console.log("📧 Raw email preview (first 500 chars):")
      console.log(debugEmail.substring(0, 500))

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
            htmlProcessed: true,
            emailFormat: "simple-html"
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
          htmlProcessed: true,
          emailFormat: "simple-html"
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