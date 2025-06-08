"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { Sidebar } from "@/components/sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { PreviewPanel } from "@/components/preview-panel"
import { ThemeProvider } from "@/components/theme-provider"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"

export default function NewChatClient() {
  const router = useRouter()

  const [currentTemplate, setCurrentTemplate] = useState<string>("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  // Function to create a new chat
  const createNewChat = async (initialMessage?: string) => {
    try {
      setIsCreatingChat(true)
      
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: initialMessage ? initialMessage.slice(0, 50) + (initialMessage.length > 50 ? '...' : '') : 'New Chat',
          initialMessage: initialMessage || undefined
        }),
      })

      const data = await response.json()

      if (data.success && data.chat) {
        // Redirect to the new chat
        router.push(`/chat/${data.chat.id}`)
        return data.chat.id
      } else {
        console.error('Failed to create chat:', data.error)
        return null
      }
    } catch (error) {
      console.error('Error creating chat:', error)
      return null
    } finally {
      setIsCreatingChat(false)
    }
  }

  // Handle message submission - this will create a new chat and redirect
  const handleMessageSubmit = async (message: string) => {
    await createNewChat(message)
  }

  return (
    <SessionProvider>
      <ThemeProvider>
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
          {/* Unified Sidebar - Navigation & Images */}
          <Sidebar 
            isOpen={sidebarOpen} 
            onToggle={() => setSidebarOpen(!sidebarOpen)} 
            currentChatId={undefined} // No current chat ID since we're creating a new one
          />

          {/* Main Content Area */}
          <div className="flex-1 flex min-w-0 overflow-hidden">
            <ChatInterface
              sidebarOpen={sidebarOpen}
              onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              chatId={""} // Empty string instead of null for new chat
              onMessageSubmit={handleMessageSubmit} // Pass the handler to create new chat
              isCreatingChat={isCreatingChat}
            />

            {/* Preview Panel - Responsive behavior */}
            <div
              className={cn(
                "transition-all duration-300 ease-in-out",
                currentTemplate ? "opacity-100" : "opacity-0 w-0 border-l-0",
                "hidden md:block", // Hide on mobile, show on medium screens and up
              )}
            >
              <PreviewPanel 
                template={currentTemplate} 
                isVisible={!!currentTemplate} 
                className="h-full" 
                chatId={undefined} // undefined instead of null
              />
            </div>
          </div>

          {/* Mobile Preview Button - Only show when there's a template and on mobile */}
          {currentTemplate && (
            <div className="md:hidden fixed bottom-20 right-4 z-50">
              <Button
                size="sm"
                className="h-12 w-12 rounded-full shadow-lg"
                onClick={() => {
                  // For new chat page, we can't preview until a chat is created
                  // This button might not be needed here, but keeping for consistency
                }}
              >
                <Eye className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </ThemeProvider>
    </SessionProvider>
  )
}