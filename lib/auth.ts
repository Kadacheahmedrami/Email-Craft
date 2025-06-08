// lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

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
async function refreshAccessToken(token: any) {
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
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions = {
  adapter: PrismaAdapter(prisma!),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (!user?.email) return false;
      
      // Add your custom validation logic here if needed
      // For example: domain validation, blacklist checking, etc.
      
      return true;
    },
    async jwt({ token, user, account }: any) {
      // Initial sign in
      if (account && user) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at * 1000,
          refreshToken: account.refresh_token,
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },
    async session({ session, token, user }: any) {
      // For database sessions, we need to fetch the tokens from the database
      if (user && session.user.email) {
        session.user.id = user.id;
        
        // Fetch the latest account information from database
        const account = await prisma!.account.findFirst({
          where: {
            userId: user.id,
            provider: "google",
          },
          select: {
            access_token: true,
            refresh_token: true,
            expires_at: true,
          },
        });

        if (account) {
          // Check if token needs refreshing
          const now = Date.now();
          const expiresAt = account.expires_at ? account.expires_at * 1000 : 0;
          
          if (expiresAt && now < expiresAt) {
            // Token is still valid
            session.accessToken = account.access_token!;
            session.refreshToken = account.refresh_token!;
          } else if (account.refresh_token) {
            // Token expired, refresh it
            try {
              const refreshedToken = await refreshAccessToken({
                refreshToken: account.refresh_token,
                accessToken: account.access_token,
                accessTokenExpires: expiresAt,
              });
              
              if (!refreshedToken.error) {
                // Update the database with new tokens
                await prisma!.account.update({
                  where: {
                    provider_providerAccountId: {
                      provider: "google",
                      providerAccountId: user.id,
                    },
                  },
                  data: {
                    access_token: refreshedToken.accessToken,
                    expires_at: Math.floor(refreshedToken.accessTokenExpires / 1000),
                    refresh_token: refreshedToken.refreshToken,
                  },
                });
                
                session.accessToken = refreshedToken.accessToken;
                session.refreshToken = refreshedToken.refreshToken;
              } else {
                session.error = "RefreshAccessTokenError";
              }
            } catch (error) {
              console.error("Error refreshing token in session:", error);
              session.error = "RefreshAccessTokenError";
            }
          }
        }
      }
      
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database" as const,
    // Seconds - How long until an idle session expires and is no longer valid.
    maxAge: 30 * 24 * 60 * 60, // 30 days
    // Seconds - Throttle how frequently to write to database to extend a session.
    updateAge: 24 * 60 * 60, // 24 hours
  },
  events: {
    async createUser({ user }: any) {
      console.log("New user created:", user.email);
    },
    async linkAccount({ user, account }: any) {
      console.log("Account linked:", user.email, account.provider);
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

export const getServerAuthSession = () => getServerSession(authOptions);