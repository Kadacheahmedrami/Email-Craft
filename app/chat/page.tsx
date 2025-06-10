// File: page.tsx (Server Component)
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { NewChatClient } from "@/components/NewChatClient"

export default async function NewChatPage() {
  // Server-side authentication check
  const session = await getServerSession(authOptions)
  
  // If user is not authenticated, redirect to sign in
  if (!session) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/chat")}`)
  }

  // If authenticated, render the client-side chat component
  return <NewChatClient session={session} />
}
