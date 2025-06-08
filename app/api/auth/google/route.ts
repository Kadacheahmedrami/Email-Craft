import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

// Scopes required for sending emails
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]

// GET - Generate OAuth2 authorization URL
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action")

    if (action === "url") {
      // Generate authorization URL
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent", // Force consent to get refresh token
        include_granted_scopes: true,
      })

      return NextResponse.json({
        success: true,
        authUrl,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Error generating auth URL:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate authorization URL",
      },
      { status: 500 },
    )
  }
}

// POST - Exchange authorization code for tokens
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Authorization code required",
        },
        { status: 400 },
      )
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: "No refresh token received. Please ensure you grant all permissions.",
        },
        { status: 400 },
      )
    }

    // Get user info
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()

    return NextResponse.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date,
      },
      user: {
        id: userInfo.data.id,
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture,
      },
    })
  } catch (error) {
    console.error("Error exchanging code for tokens:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to exchange authorization code",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
