"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Loader2, AlertCircle, Shield, Sparkles } from "lucide-react"

export default function SignInClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const callbackUrl = searchParams.get("callbackUrl") || "/chat"

  useEffect(() => {
    // Check for error in URL params
    const errorParam = searchParams.get("error")
    if (errorParam) {
      setError(getErrorMessage(errorParam))
    }
  }, [searchParams])

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case "OAuthSignin":
        return "Error occurred during OAuth sign-in process"
      case "OAuthCallback":
        return "Error occurred during OAuth callback"
      case "OAuthCreateAccount":
        return "Could not create OAuth account"
      case "EmailCreateAccount":
        return "Could not create email account"
      case "Callback":
        return "Error occurred during callback"
      case "OAuthAccountNotLinked":
        return "OAuth account is not linked to any user"
      case "EmailSignin":
        return "Check your email for a sign-in link"
      case "CredentialsSignin":
        return "Invalid credentials"
      case "SessionRequired":
        return "Please sign in to access this page"
      case "AccessDenied":
        return "Access denied. Please contact support."
      default:
        return "An error occurred during sign-in"
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await signIn("google", {
        callbackUrl,
        redirect: false,
      })

      if (result?.error) {
        setError(getErrorMessage(result.error))
      } else if (result?.url) {
        // Redirect to the callback URL
        window.location.href = result.url
      } else if (result?.ok) {
        // Sign in was successful, redirect manually
        router.push(callbackUrl)
      }
    } catch (err) {
      console.error("Sign-in error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-gray-900">EmailCraft</h1>
            <p className="text-xs text-gray-600">AI Email Designer</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Welcome Card */}
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-8">
            <div className="text-center space-y-4 mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome to EmailCraft</h2>
                <p className="text-gray-600 mt-2">
                  Sign in to create amazing email templates with AI assistance
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-12 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {isLoading ? "Signing in..." : "Continue with Google"}
            </button>

            {/* Features List */}
            <div className="pt-6 border-t border-gray-200 mt-6">
              <p className="text-sm font-medium text-center mb-3 text-gray-900">What you'll get:</p>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Secure Gmail integration for sending emails</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span>AI-powered email template generation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                  <span>Save and manage your templates</span>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="text-center text-sm text-gray-600">
            <p>
              By signing in, you agree to our{" "}
              <a href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="text-blue-600 hover:underline">
                Terms of Service
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}