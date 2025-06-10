// Server Component
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import SendEmailClient from "@/components/SendEmailClient"

interface SendEmailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SendEmailPage({ params }: SendEmailPageProps) {
  // Await params for Next.js 15 compatibility
  const { id } = await params

  // Server-side authentication check
  const session = await getServerSession(authOptions)

  // If user is not authenticated, redirect to sign in
  if (!session) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/chat/${id}/send`)}`)
  }

  // If authenticated, render the client-side component
  return <SendEmailClient chatId={id} />
}
