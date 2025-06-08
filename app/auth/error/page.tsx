"use client"

import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

const errorMessages = {
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description:
      "This email is already associated with another account. Please sign in with the original method or contact support.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Failed",
    description: "We couldn't create your account. Please try again or contact support if the problem persists.",
  },
  OAuthCallback: {
    title: "Authentication Failed",
    description: "There was an error during the authentication process. Please try signing in again.",
  },
  OAuthSignin: {
    title: "Sign In Error",
    description: "An error occurred while signing in. Please try again.",
  },
  EmailCreateAccount: {
    title: "Email Account Error",
    description: "We couldn't create an account with this email address.",
  },
  Callback: {
    title: "Callback Error",
    description: "An error occurred during the callback process.",
  },
  OAuthCallbackError: {
    title: "OAuth Error",
    description: "There was an error with the OAuth provider.",
  },
  EmailSignin: {
    title: "Email Sign In Error",
    description: "We couldn't send you a sign in email.",
  },
  CredentialsSignin: {
    title: "Invalid Credentials",
    description: "The credentials you provided are incorrect.",
  },
  SessionRequired: {
    title: "Session Required",
    description: "You must be signed in to access this page.",
  },
  default: {
    title: "Authentication Error",
    description: "An unexpected error occurred during authentication.",
  },
}

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") as keyof typeof errorMessages

  const errorInfo = errorMessages[error] || errorMessages.default

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">{errorInfo.title}</CardTitle>
          <CardDescription className="text-center">{errorInfo.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/auth/signin">Try Again</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Debug Info:</strong> {error || "Unknown error"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
