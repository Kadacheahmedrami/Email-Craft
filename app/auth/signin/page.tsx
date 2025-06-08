import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import SignInClient from "./SignInClient"

export default async function SignInPage() {
  // Server-side authentication check
  const session = await getServerSession(authOptions)
  
  // If user is already authenticated, redirect to chat
  if (session) {
    redirect("/chat")
  }

  // If not authenticated, render the client-side sign-in component
  return <SignInClient />
}