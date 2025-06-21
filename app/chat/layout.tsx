import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ChatLayoutClient } from "@/components/ChatLayoutClient"

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side authentication check
  const session = await getServerSession(authOptions)
  
  // If user is not authenticated, redirect to sign in
  if (!session) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/chat")}`)
  }

  return (
    <ChatLayoutClient session={session}>
      {children}
    </ChatLayoutClient>
  )
}