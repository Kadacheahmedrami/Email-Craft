// lib/auth.ts - Fixed version
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import type { JWT } from "next-auth/jwt";
import type { User } from "next-auth";
import type { Account } from "@prisma/client";

// Extend the NextAuth types for better TypeScript support
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

/**
 * Refreshes an access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  accessTokenExpires: number;
  refreshToken: string;
  scope: string;
} | null> {
  try {
    const url = "https://oauth2.googleapis.com/token";
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed:", refreshedTokens);
      return null;
    }

    console.log("Token refreshed successfully");
    return {
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? refreshToken,
      scope: refreshedTokens.scope || "",
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return null;
  }
}

/**
 * Tests Gmail API access with current token
 */
export async function testGmailAccess(userId: string) {
  try {
    const tokens = await getUserTokens(userId);
    if (!tokens) {
      console.log("No tokens available for Gmail test");
      return { success: false, error: "No tokens available" };
    }

    // Test with Gmail API's profile endpoint
    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );

    if (!profileResponse.ok) {
      const error = await profileResponse.json();
      console.log("Gmail profile test failed:", error);
      return { success: false, error };
    }

    const profile = await profileResponse.json();
    console.log("✅ Gmail API access confirmed for:", profile.emailAddress);
    return { success: true, email: profile.emailAddress };
  } catch (error) {
    console.error("Gmail API test error:", error);
    return { success: false, error };
  }
}

export async function debugUserTokens(userId: string) {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "google",
      },
      select: {
        access_token: true,
        refresh_token: true,
        expires_at: true,
        scope: true,
        providerAccountId: true,
      },
    });

    console.log("Account debug info:", {
      hasAccessToken: !!account?.access_token,
      hasRefreshToken: !!account?.refresh_token,
      expiresAt: account?.expires_at,
      scopes: account?.scope,
      isExpired: account?.expires_at ? Date.now() > account.expires_at * 1000 : "unknown"
    });

    // Test the token with Google's tokeninfo endpoint
    if (account?.access_token) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${account.access_token}`
        );
        const tokenInfo = await response.json();
        console.log("Token info from Google:", {
          scope: tokenInfo.scope,
          audience: tokenInfo.audience,
          expires_in: tokenInfo.expires_in,
          error: tokenInfo.error
        });
      } catch (tokenError) {
        console.error("Token validation failed:", tokenError);
      }
    }

    return account;
  } catch (error) {
    console.error("Error debugging tokens:", error);
    return null;
  }
}

/**
 * Gets fresh tokens for a user, refreshing if necessary
 */
export async function getUserTokens(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "google",
      },
      select: {
        access_token: true,
        refresh_token: true,
        expires_at: true,
        scope: true,
        providerAccountId: true,
      },
    });

    if (!account?.access_token || !account?.refresh_token) {
      console.log("No tokens found for user:", userId);
      return null;
    }

    // Check if we have the required Gmail scopes
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose'
    ];
    
    const hasRequiredScopes = requiredScopes.some(scope => 
      account.scope?.includes(scope)
    );

    if (!hasRequiredScopes) {
      console.log("❌ Missing required Gmail scopes. Current scopes:", account.scope);
      console.log("Required scopes:", requiredScopes);
      return null;
    }

    const now = Date.now();
    const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;

    // If token is still valid (with 5 minute buffer)
    if (expiresAt && now < expiresAt - 5 * 60 * 1000) {
      console.log("Using existing valid token");
      return {
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
      };
    }

    console.log("Token expired or expiring soon, refreshing...");
    // Token expired or expiring soon, refresh it
    const refreshedTokens = await refreshAccessToken(account.refresh_token);
    
    if (!refreshedTokens) {
      console.log("Failed to refresh token");
      return null;
    }

    // Update the database with new tokens
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: account.providerAccountId,
        },
      },
      data: {
        access_token: refreshedTokens.accessToken,
        expires_at: Math.floor(refreshedTokens.accessTokenExpires / 1000),
        refresh_token: refreshedTokens.refreshToken,
        scope: refreshedTokens.scope || account.scope,
      },
    });

    console.log("Token refreshed and updated in database");
    return {
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken,
    };
  } catch (error) {
    console.error("Error getting user tokens:", error);
    return null;
  }
}

// Updated auth configuration with proper Gmail scopes
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email", 
            "profile",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.compose"
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (!user?.email) return false;
      
      // Debug: Log account info during sign in
      console.log("Sign in - Account tokens:", {
        hasAccessToken: !!account?.access_token,
        hasRefreshToken: !!account?.refresh_token,
        scope: account?.scope,
        provider: account?.provider,
        expires_at: account?.expires_at
      });

      // Check if Gmail scopes are present
      const requiredScopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose'
      ];
      
      const hasGmailScopes = requiredScopes.some(scope => 
        account?.scope?.includes(scope)
      );

      if (!hasGmailScopes) {
        console.log("❌ Gmail scopes not granted during sign in");
        console.log("Granted scopes:", account?.scope);
        console.log("Required scopes:", requiredScopes);
      } else {
        console.log("✅ Gmail scopes granted successfully");
      }
      
      return true;
    },
    async session({ session, user }: any) {
      if (user && session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ 
      token, 
      account, 
      user 
    }: { 
      token: JWT; 
      account: Account | null; 
      user: User | null;
    }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          id: user.id,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : 0,
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to update it
      if (token.refreshToken) {
        const refreshedTokens = await refreshAccessToken(token.refreshToken as string);
        if (refreshedTokens) {
          return {
            ...token,
            accessToken: refreshedTokens.accessToken,
            accessTokenExpires: refreshedTokens.accessTokenExpires,
            refreshToken: refreshedTokens.refreshToken,
          };
        }
      }

      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  events: {
    async createUser({ user }: any) {
      console.log("New user created:", user.email);
    },
    async linkAccount({ user, account }: any) {
      console.log("Account linked:", user.email, account.provider);
      console.log("Linked account scope:", account.scope);
      
      // Verify Gmail scope was granted
      const requiredScopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose'
      ];
      
      const hasGmailScopes = requiredScopes.some(scope => 
        account.scope?.includes(scope)
      );

      if (hasGmailScopes) {
        console.log("✅ Gmail scopes granted successfully");
      } else {
        console.log("❌ Gmail scopes NOT granted:", account.scope);
        console.log("Required scopes:", requiredScopes);
      }
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

export const getServerAuthSession = () => getServerSession(authOptions);