"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { PreviewPanel } from "@/components/preview-panel"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string

  const [currentTemplate, setCurrentTemplate] = useState<string>("")
  const [uploadedImages, setUploadedImages] = useState<any[]>([])
  const [conversation, setConversation] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load chat data from backend
  useEffect(() => {
    async function fetchChat() {
      if (!chatId) return

      try {
        setIsLoading(true)
        const res = await fetch(`/api/chats/${chatId}`)

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || "Failed to load chat")
          return
        }

        const data = await res.json()
        const chat = data.chat

        setConversation(chat.messages || [])
        setUploadedImages(chat.images || [])
        setCurrentTemplate(chat.currentTemplate || "")

        // Persist to localStorage
        if (chat.currentTemplate) {
          localStorage.setItem(`template_${chatId}`, chat.currentTemplate)
        }

        setError(null)
      } catch (err) {
        console.error("Error loading chat:", err)
        setError("Unexpected error while loading chat")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChat()
  }, [chatId])

  if (isLoading) {
    return (
      <div className="flex items-center  bg-background text-foreground justify-center h-screen text-xl">
        Loading chat...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500 text-xl">
        {error}
      </div>
    )
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          conversation={conversation}
          onNewChat={() => {
            setConversation([])
            setCurrentTemplate("")
          }}
          images={uploadedImages}
          onImagesChange={setUploadedImages}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId={chatId}
        />

        {/* Chat Interface */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <ChatInterface
            conversation={conversation}
            onConversationChange={setConversation}
            currentTemplate={currentTemplate}
            onTemplateChange={(template) => {
              setCurrentTemplate(template)
              localStorage.setItem(`template_${chatId}`, template)
            }}
            uploadedImages={uploadedImages}
            isGenerating={isGenerating}
            onGeneratingChange={setIsGenerating}
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            chatId={chatId}
          />

          {/* Preview Panel */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out",
              currentTemplate ? "opacity-100" : "opacity-0 w-0 border-l-0",
              "hidden md:block",
            )}
          >
            <PreviewPanel
              template={currentTemplate}
              isVisible={!!currentTemplate}
              className="h-full"
              chatId={chatId}
            />
          </div>
        </div>

        {/* Mobile Preview Button */}
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
