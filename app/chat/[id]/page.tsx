"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
  const searchParams = useSearchParams()
  const chatId = params.id as string
  const initialMessage = searchParams.get("initialMessage")

  const [currentTemplate, setCurrentTemplate] = useState<string>("")
  const [uploadedImages, setUploadedImages] = useState<any[]>([])
  const [conversation, setConversation] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialMessageProcessed, setInitialMessageProcessed] = useState(false)

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

  // Process initial message if present
  useEffect(() => {
    if (
      initialMessage &&
      !initialMessageProcessed &&
      !isLoading &&
      !isGenerating &&
      chatId &&
      conversation.length === 0
    ) {
      // Mark as processed to prevent multiple submissions
      setInitialMessageProcessed(true)

      // Process the initial message directly
      processInitialMessage(initialMessage)

      // Clean up the URL by removing the initialMessage parameter
      const newUrl = `/chat/${chatId}`
      window.history.replaceState({}, "", newUrl)
    }
  }, [initialMessage, initialMessageProcessed, isLoading, isGenerating, chatId, conversation.length])

  // Add this new function to process the initial message
  const processInitialMessage = async (message: string) => {
    setIsGenerating(true)

    // Optimistically add user message to UI
    const tempUserMessage = {
      id: `temp-user-${Date.now()}`,
      role: "USER" as const,
      content: message,
      createdAt: new Date().toISOString(),
    }

    const updatedConversation = [tempUserMessage]
    setConversation(updatedConversation)

    try {
      // Add user message to database
      const userMessageResponse = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "USER",
          content: message,
        }),
      })

      const userMessageData = await userMessageResponse.json()
      if (userMessageResponse.ok && userMessageData.success && userMessageData.message) {
        // Replace temp message with real one
        const conversationWithRealUser = updatedConversation.map((msg) =>
          msg.id === tempUserMessage.id ? userMessageData.message : msg,
        )
        setConversation(conversationWithRealUser)
      }

      // Generate AI response
      const aiResponse = await fetch("/api/email-styler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          conversation: [],
          sessionId: chatId,
          maintainMemory: true,
          latestTemplate: "",
        }),
      })

      if (!aiResponse.ok) {
        throw new Error(`HTTP error! status: ${aiResponse.status}`)
      }

      const aiData = await aiResponse.json()

      if (aiData.success) {
        const aiMessageContent =
          aiData.aiResponse ||
          "I've generated a professional email template based on your requirements. You can see the preview on the right panel."

        // Update template immediately when AI responds
        if (aiData.template) {
          handleTemplateChange(aiData.template)
        }

        // Add AI message to database
        const aiMessageResponse = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "AI",
            content: aiMessageContent,
            generatedTemplate: aiData.template,
            metadata: aiData.metadata || {},
          }),
        })

        const aiMessageData = await aiMessageResponse.json()
        if (aiMessageResponse.ok && aiMessageData.success && aiMessageData.message) {
          const finalConversation = [
            ...updatedConversation.filter((msg) => msg.id !== tempUserMessage.id),
            userMessageData?.message || tempUserMessage,
            aiMessageData.message,
          ]
          setConversation(finalConversation)

          // Update chat's current template
          try {
            await fetch(`/api/chats/${chatId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                currentTemplate: aiData.template,
              }),
            })
          } catch (updateError) {
            console.warn("Failed to update chat template:", updateError)
          }
        } else {
          // Fallback: add message to UI even if DB save failed
          const fallbackMessage = {
            id: `ai-${Date.now()}`,
            role: "AI" as const,
            content: aiMessageContent,
            generatedTemplate: aiData.template,
            createdAt: new Date().toISOString(),
            metadata: aiData.metadata || {},
          }
          const finalConversation = [...updatedConversation, fallbackMessage]
          setConversation(finalConversation)
        }
      } else {
        throw new Error(aiData.error || "Failed to generate template")
      }
    } catch (error) {
      console.error("Error processing initial message:", error)

      const errorMessage = {
        id: `error-${Date.now()}`,
        role: "AI" as const,
        content: "Sorry, I encountered an error while generating your template. Please try again.",
        createdAt: new Date().toISOString(),
      }

      // Try to save error message to database
      try {
        const errorMessageResponse = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "AI",
            content: errorMessage.content,
          }),
        })

        const errorMessageData = await errorMessageResponse.json()
        if (errorMessageResponse.ok && errorMessageData.success && errorMessageData.message) {
          const finalConversation = [...updatedConversation, errorMessageData.message]
          setConversation(finalConversation)
        } else {
          const finalConversation = [...updatedConversation, errorMessage]
          setConversation(finalConversation)
        }
      } catch (saveError) {
        console.warn("Failed to save error message:", saveError)
        const finalConversation = [...updatedConversation, errorMessage]
        setConversation(finalConversation)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle template updates - this fixes the immediate update issue
  const handleTemplateChange = (template: string) => {
    setCurrentTemplate(template)
    // Also save to localStorage for persistence
    if (chatId) {
      localStorage.setItem(`template_${chatId}`, template)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center bg-background text-foreground justify-center h-screen text-xl">
        Loading chat...
      </div>
    )
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500 text-xl">{error}</div>
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
          } }
          images={uploadedImages}
          onImagesChange={setUploadedImages}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId={chatId} session={{
            user: {
              name: undefined,
              email: undefined
            }
          }}        />

        {/* Chat Interface */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <ChatInterface
            conversation={conversation}
            onConversationChange={setConversation}
            currentTemplate={currentTemplate}
            onTemplateChange={handleTemplateChange}
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
            <PreviewPanel template={currentTemplate} isVisible={!!currentTemplate} className="h-full" chatId={chatId} />
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
