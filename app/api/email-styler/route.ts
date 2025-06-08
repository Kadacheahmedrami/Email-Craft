import { GoogleGenerativeAI } from "@google/generative-ai"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Enhanced Vector Operations for Email Template Matching
 */
class EmailVectorOperations {
  private static embeddingCache = new Map<string, number[]>()
  private static readonly CACHE_SIZE_LIMIT = 100

  static async getEmbedding(text: string, genAI: GoogleGenerativeAI): Promise<number[]> {
    const cacheKey = this.createCacheKey(text)

    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!
    }

    try {
      const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" })
      const result = await embeddingModel.embedContent(text)
      const embedding = result.embedding.values

      // Manage cache size
      if (this.embeddingCache.size >= this.CACHE_SIZE_LIMIT) {
        const firstKey = this.embeddingCache.keys().next().value
        this.embeddingCache.delete(firstKey!)
      }

      this.embeddingCache.set(cacheKey, embedding)
      return embedding
    } catch (error) {
      console.error("Error generating embedding:", error)
      return []
    }
  }

  private static createCacheKey(text: string): string {
    return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100)
  }

  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    const normProduct = Math.sqrt(normA) * Math.sqrt(normB)
    if (normProduct === 0) return 0

    return Math.max(-1, Math.min(1, dotProduct / normProduct))
  }
}

// Enhanced email template structure
interface EmailTemplate {
  id: string
  name: string
  category: string
  description: string
  useCase: string
  style: string
  colorScheme: string
  layout: string
  complexity: "simple" | "moderate" | "complex"
  responsive: boolean
  tags: string[]
}

// Conversation message structure
interface EmailConversationMessage {
  role: "user" | "ai"
  content: string
  generatedTemplate?: string
  timestamp?: string
  sessionId?: string
  metadata?: {
    templateType?: string
    userIntent?: string
    satisfaction?: number
  }
}

// Enhanced request payload
interface EmailStylerRequest {
  message: string
  conversation: EmailConversationMessage[]
  sessionId?: string
  templatePreferences?: {
    style?: string
    colorScheme?: string
    purpose?: string
    complexity?: "simple" | "moderate" | "complex"
    responsive?: boolean
  }
  maintainMemory?: boolean
  contextWindow?: number
}

// Gemini chat message format
interface GeminiChatMessage {
  role: "user" | "model"
  parts: Array<{ text: string }>
}

// Enhanced chat session management
class ChatSessionManager {
  private static sessions = new Map<string, any>()
  private static sessionHistory = new Map<string, GeminiChatMessage[]>()
  private static sessionMetadata = new Map<
    string,
    {
      createdAt: number
      lastActivity: number
      messageCount: number
      userPreferences: any
    }
  >()

  static generateSessionId(): string {
    return `email_chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  static getOrCreateSession(
    genAI: GoogleGenerativeAI,
    sessionId?: string,
  ): {
    sessionId: string
    chatSession: any
    history: GeminiChatMessage[]
    metadata: any
  } {
    const currentSessionId = sessionId || this.generateSessionId()

    if (!this.sessions.has(currentSessionId)) {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: this.getSystemInstruction(),
      })

      const history = this.sessionHistory.get(currentSessionId) || []

      const chatSession = model.startChat({
        history: history,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      })

      this.sessions.set(currentSessionId, chatSession)

      if (!this.sessionHistory.has(currentSessionId)) {
        this.sessionHistory.set(currentSessionId, [])
      }

      if (!this.sessionMetadata.has(currentSessionId)) {
        this.sessionMetadata.set(currentSessionId, {
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 0,
          userPreferences: {},
        })
      }
    }

    // Update activity timestamp
    const metadata = this.sessionMetadata.get(currentSessionId)!
    metadata.lastActivity = Date.now()
    metadata.messageCount += 1

    return {
      sessionId: currentSessionId,
      chatSession: this.sessions.get(currentSessionId),
      history: this.sessionHistory.get(currentSessionId) || [],
      metadata,
    }
  }

  private static getSystemInstruction(): string {
    return `You are an expert email template designer and HTML/CSS specialist. Your role is to create professional, responsive email templates with perfect conversation memory.

CORE PRINCIPLES:
- Generate COMPLETE HTML email templates with inline CSS only
- NO external stylesheets, JavaScript, keyframes, animations, or hover effects
- Use table-based layouts for maximum email client compatibility
- Implement responsive design using media queries in <style> tags
- Create visually stunning yet professional designs
- Maintain conversation context and build upon previous work

TECHNICAL REQUIREMENTS:
1. All CSS must be inline or in <style> tags within <head>
2. Use web-safe fonts and email-safe properties
3. Ensure compatibility with Outlook, Gmail, Apple Mail, etc.
4. Include proper viewport meta tags for mobile
5. Use semantic HTML structure where possible
6. Test responsive breakpoints at 600px and below

RESPONSIVE EMAIL TEMPLATE STRUCTURE:
Always use this base structure for maximum compatibility:

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Email Template</title>
    <style>
        /* Reset styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #f4f4f4; }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
        
        /* Container styles */
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .content-wrapper { padding: 20px; }
        
        /* Responsive styles */
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .content-wrapper { padding: 15px !important; }
            .mobile-center { text-align: center !important; }
            .mobile-full-width { width: 100% !important; display: block !important; }
            .mobile-padding { padding: 10px !important; }
            .mobile-font-size { font-size: 16px !important; line-height: 24px !important; }
            .mobile-hide { display: none !important; }
            .mobile-show { display: block !important; }
        }
        
        @media only screen and (max-width: 480px) {
            .content-wrapper { padding: 10px !important; }
            .mobile-small-padding { padding: 5px !important; }
            .mobile-small-font { font-size: 14px !important; line-height: 20px !important; }
        }
    </style>
</head>
<body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <!-- Email content goes here -->
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

LAYOUT GUIDELINES:
1. Always center the main email container
2. Use max-width: 600px for desktop, 100% for mobile
3. Add proper padding that scales down on mobile
4. Use table-based layouts with role="presentation"
5. Include fallback fonts: Arial, Helvetica, sans-serif
6. Use relative units (%) for widths where possible
7. Test all layouts at 320px, 480px, and 600px+ widths

DESIGN STANDARDS:
- Professional color schemes with good contrast
- Clean typography with appropriate hierarchy  
- Balanced white space and visual rhythm
- Clear call-to-action buttons with proper touch targets (44px minimum)
- Consistent branding elements
- Accessibility considerations (alt text, color contrast)
- Proper email client dark mode support

MOBILE OPTIMIZATION:
- Single column layout on mobile
- Larger touch targets for buttons (minimum 44px height)
- Readable font sizes (minimum 14px on mobile)
- Adequate spacing between elements
- Simplified navigation and content hierarchy

Remember our conversation history and iterate on previous designs when requested.`
  }

  static updateSessionHistory(sessionId: string, userMessage: string, aiResponse: string, metadata?: any) {
    const history = this.sessionHistory.get(sessionId) || []

    history.push({
      role: "user",
      parts: [{ text: userMessage }],
    })

    history.push({
      role: "model",
      parts: [{ text: aiResponse }],
    })

    // Keep history manageable (last 20 messages)
    if (history.length > 20) {
      history.splice(0, history.length - 20)
    }

    this.sessionHistory.set(sessionId, history)

    // Update user preferences based on feedback
    if (metadata?.userPreferences) {
      const sessionMeta = this.sessionMetadata.get(sessionId)
      if (sessionMeta) {
        sessionMeta.userPreferences = { ...sessionMeta.userPreferences, ...metadata.userPreferences }
      }
    }
  }

  static getSessionSummary(sessionId: string): {
    summary: string
    messageCount: number
    preferences: any
    lastActivity: number
  } {
    const history = this.sessionHistory.get(sessionId) || []
    const metadata = this.sessionMetadata.get(sessionId)

    if (history.length === 0) {
      return {
        summary: "",
        messageCount: 0,
        preferences: {},
        lastActivity: Date.now(),
      }
    }

    const recentMessages = history.slice(-6) // Last 3 exchanges
    const summary = recentMessages.map((msg) => `${msg.role}: ${msg.parts[0]?.text?.substring(0, 150)}...`).join("\n")

    return {
      summary,
      messageCount: metadata?.messageCount || history.length / 2,
      preferences: metadata?.userPreferences || {},
      lastActivity: metadata?.lastActivity || Date.now(),
    }
  }

  static clearSession(sessionId: string): boolean {
    const existed = this.sessions.has(sessionId)
    this.sessions.delete(sessionId)
    this.sessionHistory.delete(sessionId)
    this.sessionMetadata.delete(sessionId)
    return existed
  }

  static clearOldSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
    let clearedCount = 0
    const now = Date.now()

    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      if (now - metadata.lastActivity > maxAge) {
        this.clearSession(sessionId)
        clearedCount++
      }
    }

    return clearedCount
  }

  static getActiveSessionsCount(): number {
    return this.sessions.size
  }
}

// Enhanced email template knowledge base
const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "corporate-modern",
    name: "Corporate Modern",
    category: "Business",
    description: "Clean, professional design with minimal styling and clear hierarchy",
    useCase: "Business communications, announcements, reports, formal correspondence",
    style: "Minimalist, Corporate, Professional",
    colorScheme: "Blue, White, Gray, Navy",
    layout: "Single column, structured, header-body-footer",
    complexity: "simple",
    responsive: true,
    tags: ["business", "professional", "clean", "minimal", "corporate"],
  },
  {
    id: "newsletter-vibrant",
    name: "Newsletter Vibrant",
    category: "Marketing",
    description: "Eye-catching design with vibrant colors for newsletters and promotions",
    useCase: "Marketing campaigns, newsletters, promotions, brand communications",
    style: "Modern, Colorful, Engaging, Bold",
    colorScheme: "Gradient, Brand colors, Vibrant",
    layout: "Multi-section, card-based, hero-content-footer",
    complexity: "moderate",
    responsive: true,
    tags: ["marketing", "newsletter", "colorful", "engaging", "promotional"],
  },
  {
    id: "transactional-clean",
    name: "Transactional Clean",
    category: "Transactional",
    description: "Simple, clear design focused on information delivery and readability",
    useCase: "Order confirmations, receipts, notifications, status updates",
    style: "Clean, Functional, Minimal, Clear",
    colorScheme: "Neutral, Accent colors, Monochrome",
    layout: "Structured, informational, data-focused",
    complexity: "simple",
    responsive: true,
    tags: ["transactional", "clean", "functional", "receipt", "confirmation"],
  },
  {
    id: "welcome-elegant",
    name: "Welcome Elegant",
    category: "Onboarding",
    description: "Welcoming design with elegant styling for new user experiences",
    useCase: "Welcome emails, onboarding sequences, user activation",
    style: "Elegant, Friendly, Welcoming, Sophisticated",
    colorScheme: "Warm colors, Professional, Soft pastels",
    layout: "Hero section, progressive disclosure, CTA-focused",
    complexity: "moderate",
    responsive: true,
    tags: ["welcome", "onboarding", "elegant", "friendly", "activation"],
  },
  {
    id: "event-dynamic",
    name: "Event Dynamic",
    category: "Events",
    description: "Dynamic design with visual elements for event communications",
    useCase: "Event invitations, announcements, updates, RSVPs",
    style: "Dynamic, Engaging, Visual, Interactive",
    colorScheme: "Bold, Themed, Event-specific",
    layout: "Visual-first, action-oriented, date-prominent",
    complexity: "complex",
    responsive: true,
    tags: ["event", "invitation", "dynamic", "visual", "interactive"],
  },
  {
    id: "ecommerce-product",
    name: "E-commerce Product",
    category: "E-commerce",
    description: "Product-focused design with clear CTAs and shopping elements",
    useCase: "Product announcements, sales, recommendations, abandoned cart",
    style: "Commercial, Product-focused, Conversion-oriented",
    colorScheme: "Brand-aligned, High contrast CTAs",
    layout: "Product grid, pricing-focused, multi-CTA",
    complexity: "complex",
    responsive: true,
    tags: ["ecommerce", "product", "sales", "shopping", "conversion"],
  },
]

// Template embeddings cache
const templateEmbeddingsCache: Array<{ template: EmailTemplate; embedding: number[] }> = []
const SIMILARITY_THRESHOLD = 0.5

// Helper functions
function buildConversationContext(conversation: EmailConversationMessage[], contextWindow = 6): string {
  if (conversation.length === 0) return ""

  let context = "\n\nCONVERSATION CONTEXT:\n"

  const recentMessages = conversation.slice(-contextWindow)
  recentMessages.forEach((msg, index) => {
    context += `${msg.role.toUpperCase()}: ${msg.content}\n`

    if (msg.generatedTemplate && index === recentMessages.length - 1) {
      context += `LATEST GENERATED TEMPLATE PREVIEW:\n${msg.generatedTemplate.substring(0, 300)}...\n`
    }

    if (msg.metadata?.templateType) {
      context += `Template Type: ${msg.metadata.templateType}\n`
    }
  })

  return context
}

function analyzeUserIntent(message: string): {
  intent: string
  templateType?: string
  complexity?: "simple" | "moderate" | "complex"
  isIteration: boolean
} {
  const lowerMessage = message.toLowerCase()

  // Check if it's an iteration request
  const isIteration = /\b(change|modify|update|edit|improve|adjust|tweak|revise)\b/.test(lowerMessage)

  // Determine template type
  let templateType = "general"
  if (/\b(newsletter|marketing|campaign)\b/.test(lowerMessage)) templateType = "newsletter"
  else if (/\b(welcome|onboard|greeting)\b/.test(lowerMessage)) templateType = "welcome"
  else if (/\b(invoice|receipt|transaction|order|confirmation)\b/.test(lowerMessage)) templateType = "transactional"
  else if (/\b(event|invitation|rsvp|announcement)\b/.test(lowerMessage)) templateType = "event"
  else if (/\b(business|corporate|professional|formal)\b/.test(lowerMessage)) templateType = "corporate"
  else if (/\b(product|shop|buy|sale|ecommerce)\b/.test(lowerMessage)) templateType = "ecommerce"

  // Determine complexity
  let complexity: "simple" | "moderate" | "complex" = "moderate"
  if (/\b(simple|basic|minimal|clean)\b/.test(lowerMessage)) complexity = "simple"
  else if (/\b(complex|advanced|detailed|rich|interactive)\b/.test(lowerMessage)) complexity = "complex"

  return {
    intent: isIteration ? "iterate" : "create",
    templateType,
    complexity,
    isIteration,
  }
}

// Enhanced email template generator with better responsive design
function generateResponsiveEmailTemplate(content: string, templateType: string, style: string): string {
  const baseTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Email Template</title>
    <style>
        /* Reset and base styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            margin: 0; 
            padding: 0; 
            width: 100% !important; 
            min-width: 100%; 
            background-color: #f4f4f4; 
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.6;
            color: #333333;
        }
        table { 
            border-collapse: collapse; 
            mso-table-lspace: 0pt; 
            mso-table-rspace: 0pt; 
            width: 100%;
        }
        img { 
            border: 0; 
            height: auto; 
            line-height: 100%; 
            outline: none; 
            text-decoration: none; 
            max-width: 100%; 
            display: block;
        }
        
        /* Container styles */
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .content-wrapper { 
            padding: 30px 20px; 
        }
        .header { 
            background-color: #2563eb; 
            color: white; 
            padding: 20px; 
            text-align: center; 
        }
        .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666666; 
        }
        
        /* Typography */
        h1 { 
            font-size: 28px; 
            line-height: 1.2; 
            margin-bottom: 20px; 
            font-weight: bold;
        }
        h2 { 
            font-size: 24px; 
            line-height: 1.3; 
            margin-bottom: 16px; 
            font-weight: bold;
        }
        h3 { 
            font-size: 20px; 
            line-height: 1.4; 
            margin-bottom: 12px; 
            font-weight: bold;
        }
        p { 
            font-size: 16px; 
            line-height: 1.6; 
            margin-bottom: 16px; 
        }
        
        /* Button styles */
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            text-align: center;
            min-height: 44px;
            line-height: 20px;
        }
        .btn:hover {
            background-color: #1d4ed8;
        }
        
        /* Responsive styles */
        @media only screen and (max-width: 600px) {
            .email-container { 
                width: 100% !important; 
                max-width: 100% !important; 
                margin: 0 !important;
            }
            .content-wrapper { 
                padding: 20px 15px !important; 
            }
            .header, .footer { 
                padding: 15px !important; 
            }
            .mobile-center { 
                text-align: center !important; 
            }
            .mobile-full-width { 
                width: 100% !important; 
                display: block !important; 
            }
            .mobile-padding { 
                padding: 15px !important; 
            }
            .mobile-font-size { 
                font-size: 16px !important; 
                line-height: 24px !important; 
            }
            .mobile-hide { 
                display: none !important; 
            }
            .mobile-show { 
                display: block !important; 
            }
            h1 { 
                font-size: 24px !important; 
                line-height: 1.2 !important; 
            }
            h2 { 
                font-size: 20px !important; 
                line-height: 1.3 !important; 
            }
            h3 { 
                font-size: 18px !important; 
                line-height: 1.4 !important; 
            }
            .btn {
                width: 100% !important;
                display: block !important;
                margin: 10px 0 !important;
                padding: 15px 20px !important;
            }
        }
        
        @media only screen and (max-width: 480px) {
            .content-wrapper { 
                padding: 15px 10px !important; 
            }
            .header, .footer { 
                padding: 10px !important; 
            }
            .mobile-small-padding { 
                padding: 10px !important; 
            }
            .mobile-small-font { 
                font-size: 14px !important; 
                line-height: 20px !important; 
            }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .email-container {
                background-color: #1f2937 !important;
                color: #f9fafb !important;
            }
            .footer {
                background-color: #374151 !important;
                color: #d1d5db !important;
            }
        }
    </style>
</head>
<body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 20px 10px;">
                <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0">
                    ${content}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

  return baseTemplate
}

// Main API handlers
export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now()

    const {
      message,
      conversation = [],
      sessionId,
      templatePreferences = {},
      maintainMemory = true,
      contextWindow = 6,
    }: EmailStylerRequest = await req.json()

    // Validation
    if (!message?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Message is required",
          code: "MISSING_MESSAGE",
        },
        { status: 400 },
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "API configuration error",
          code: "MISSING_API_KEY",
        },
        { status: 500 },
      )
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // Clean old sessions periodically
    const clearedSessions = ChatSessionManager.clearOldSessions()
    if (clearedSessions > 0) {
      console.log(`Cleared ${clearedSessions} old sessions`)
    }

    // Analyze user intent
    const userIntent = analyzeUserIntent(message)

    // Get or create chat session
    const {
      sessionId: currentSessionId,
      chatSession,
      history,
      metadata,
    } = ChatSessionManager.getOrCreateSession(genAI, sessionId)

    // Initialize template embeddings if empty
    if (templateEmbeddingsCache.length === 0) {
      console.log("Initializing template embeddings cache...")
      for (const template of EMAIL_TEMPLATES) {
        const templateText = [
          template.name,
          template.category,
          template.description,
          template.useCase,
          template.style,
          template.colorScheme,
          ...template.tags,
        ].join(" ")

        const embedding = await EmailVectorOperations.getEmbedding(templateText, genAI)
        templateEmbeddingsCache.push({ template, embedding })
      }
    }

    // Find relevant templates using vector similarity
    const queryEmbedding = await EmailVectorOperations.getEmbedding(
      `${message} ${userIntent.templateType} ${userIntent.complexity}`,
      genAI,
    )

    const similarityScores = templateEmbeddingsCache.map((item) => ({
      template: item.template,
      similarity: EmailVectorOperations.cosineSimilarity(queryEmbedding, item.embedding),
    }))

    similarityScores.sort((a, b) => b.similarity - a.similarity)
    const relevantTemplates = similarityScores.filter((item) => item.similarity >= SIMILARITY_THRESHOLD).slice(0, 3)

    // Build conversation context
    const conversationContext = buildConversationContext(conversation, contextWindow)

    // Create enhanced prompt
    const enhancedPrompt = `
USER REQUEST: "${message}"

ANALYSIS:
- Intent: ${userIntent.intent}
- Template Type: ${userIntent.templateType}
- Complexity: ${userIntent.complexity}
- Is Iteration: ${userIntent.isIteration}

RELEVANT TEMPLATE STYLES:
${relevantTemplates
  .map(
    (item, index) =>
      `${index + 1}. ${item.template.name} (${(item.similarity * 100).toFixed(1)}% match)
     Category: ${item.template.category}
     Style: ${item.template.style}
     Use Case: ${item.template.useCase}
     Layout: ${item.template.layout}`,
  )
  .join("\n")}

USER PREFERENCES:
${Object.entries(templatePreferences)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

SESSION CONTEXT:
- Session: ${currentSessionId}
- Message Count: ${metadata.messageCount}
- User Preferences: ${JSON.stringify(metadata.userPreferences)}
${conversationContext}

CRITICAL INSTRUCTIONS:
1. Generate a COMPLETE, RESPONSIVE HTML email template
2. Use the responsive email structure provided in your system instructions
3. Ensure the template is centered and properly contained
4. Include proper mobile breakpoints and responsive styles
5. Use table-based layouts for maximum email client compatibility
6. Test the layout works at 320px, 480px, and 600px+ widths
7. Include proper viewport meta tags and CSS reset
8. Make sure all content is properly centered and contained
9. Use inline CSS and <style> tags only - NO external stylesheets
10. Ensure buttons have minimum 44px touch targets on mobile

TEMPLATE REQUIREMENTS:
- Maximum width: 600px on desktop
- Responsive design that works on all devices
- Proper email client compatibility (Outlook, Gmail, Apple Mail)
- Clean, professional design with good typography
- Accessible color contrast and alt text for images
- Proper spacing and visual hierarchy

Provide ONLY the complete HTML template with inline CSS.
`

    // Generate response
    let result
    let aiResponse
    let processingTime = 0

    try {
      const genStart = Date.now()

      if (maintainMemory && chatSession) {
        result = await chatSession.sendMessage(enhancedPrompt)
        aiResponse = result.response.text()

        // Update session history with metadata
        ChatSessionManager.updateSessionHistory(currentSessionId, message, aiResponse, {
          userPreferences: {
            ...templatePreferences,
            lastTemplateType: userIntent.templateType,
            lastComplexity: userIntent.complexity,
          },
        })
      } else {
        // Fallback to stateless generation
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
        result = await model.generateContent(enhancedPrompt)
        aiResponse = result.response.text()
      }

      processingTime = Date.now() - genStart
    } catch (genError) {
      console.error("Template generation error:", genError)
      throw new Error(`Template generation failed: ${genError}`)
    }

    // Extract HTML template from response
    const templateMatch =
      aiResponse.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i) || aiResponse.match(/<html[\s\S]*?<\/html>/i)

    const extractedTemplate = templateMatch ? templateMatch[0] : aiResponse

    // Build response
    const sessionSummary = ChatSessionManager.getSessionSummary(currentSessionId)
    const totalTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      template: extractedTemplate,
      aiResponse: `I've created a ${userIntent.templateType} email template based on your requirements. The design incorporates ${relevantTemplates[0]?.template.style || "modern"} styling and is fully responsive for all email clients.`,
      sessionId: currentSessionId,
      conversation: [
        ...conversation,
        {
          role: "user" as const,
          content: message,
          timestamp: new Date().toISOString(),
          sessionId: currentSessionId,
          metadata: {
            templateType: userIntent.templateType,
            userIntent: userIntent.intent,
          },
        },
        {
          role: "ai" as const,
          content: `I've created a ${userIntent.templateType} email template based on your requirements.`,
          generatedTemplate: extractedTemplate,
          timestamp: new Date().toISOString(),
          sessionId: currentSessionId,
          metadata: {
            templateType: userIntent.templateType,
            userIntent: userIntent.intent,
          },
        },
      ],
      metadata: {
        sessionSummary,
        relevantTemplates: relevantTemplates.map((item) => ({
          name: item.template.name,
          similarity: item.similarity,
          category: item.template.category,
        })),
        userIntent,
        performance: {
          totalTime,
          processingTime,
          templateCacheSize: templateEmbeddingsCache.length,
          activeSessions: ChatSessionManager.getActiveSessionsCount(),
        },
        memoryEnabled: maintainMemory,
        historyLength: history.length,
      },
    })
  } catch (error) {
    console.error("Email styler API error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate email template",
        details: error instanceof Error ? error.message : String(error),
        code: "GENERATION_ERROR",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// GET - Retrieve session information
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      // Return general stats
      return NextResponse.json({
        success: true,
        stats: {
          activeSessions: ChatSessionManager.getActiveSessionsCount(),
          templateCache: templateEmbeddingsCache.length,
          availableTemplates: EMAIL_TEMPLATES.length,
        },
      })
    }

    const sessionSummary = ChatSessionManager.getSessionSummary(sessionId)

    return NextResponse.json({
      success: true,
      sessionId,
      ...sessionSummary,
      exists: sessionSummary.messageCount > 0,
    })
  } catch (error) {
    console.error("Error retrieving session info:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve session information",
        details: String(error),
      },
      { status: 500 },
    )
  }
}

// DELETE - Clear session or all sessions
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")
    const clearAll = searchParams.get("clearAll") === "true"

    if (clearAll) {
      // Clear all sessions
      const count = ChatSessionManager.getActiveSessionsCount()
      ChatSessionManager["sessions"].clear()
      ChatSessionManager["sessionHistory"].clear()
      ChatSessionManager["sessionMetadata"].clear()

      return NextResponse.json({
        success: true,
        message: `Cleared ${count} sessions`,
        clearedCount: count,
      })
    }

    if (sessionId) {
      const existed = ChatSessionManager.clearSession(sessionId)

      return NextResponse.json({
        success: true,
        message: existed ? `Session ${sessionId} cleared` : `Session ${sessionId} not found`,
        existed,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Session ID or clearAll parameter required",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Error clearing sessions:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear sessions",
        details: String(error),
      },
      { status: 500 },
    )
  }
}
