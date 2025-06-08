"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { PreviewPanel } from "@/components/preview-panel"
import { ThemeProvider } from "@/components/theme-provider"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const chatId = params.id as string

  const [currentTemplate, setCurrentTemplate] = useState<string>("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/signin?callback") {
      router.push(\`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`)
      return
    }
  }, [status, router])

  // Load chat data when authenticated
  useEffect(() => {
    if (session && chatId) {
      loadChatData()
    }
  }, [session, chatId])

  const loadChatData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/chats/${chatId}`)
      const data = await response.json()

      if (data.success) {
        setCurrentTemplate(data.chat.currentTemplate || "")
      } else if (response.status === 404) {
        // Chat doesn't exist, redirect to home
        router.push("/")
      }
    } catch (error) {
      console.error("Failed to load chat:", error)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <ThemeProvider>
        <div className="h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Eye className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Loading Chat</h3>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  if (!session) {
    return null
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Unified Sidebar - Navigation & Images */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} currentChatId={chatId} />

        {/* Main Content Area */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <ChatInterface
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            chatId={chatId}
          />

          {/* Preview Panel - Responsive behavior */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out",
              currentTemplate ? "opacity-100" : "opacity-0 w-0 border-l-0",
              "hidden md:block", // Hide on mobile, show on medium screens and up
            )}
          >
            <PreviewPanel template={currentTemplate} isVisible={!!currentTemplate} className="h-full" chatId={chatId} />
          </div>
        </div>

        {/* Mobile Preview Button - Only show when there's a template and on mobile */}
        {currentTemplate && (
          <div className="md:hidden fixed bottom-20 right-4 z-50">
            <Button
              size="sm"
              className="h-12 w-12 rounded-full shadow-lg"
              onClick={() => {
                router.push(`/chat/${chatId}/preview`)
              }}
            >
              <Eye className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}
