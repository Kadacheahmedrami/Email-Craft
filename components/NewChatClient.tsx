"use client"

import type React from "react"

import { useState, useRef } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Send, Loader2, ImageIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"

// File: components/NewChatClient.tsx (Client Component)


export function NewChatClient({ 
  session 
}: { 
  session: { user: { name?: string; email?: string } } 
}) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [uploadedImages, setUploadedImages] = useState<any[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle creating a new chat with the initial message
  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isCreating) return

    setIsCreating(true)

    try {
      // 1. Create a new chat
      const chatResponse = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: input.substring(0, 50) }),
      })

      if (!chatResponse.ok) {
        throw new Error("Failed to create chat")
      }

      const chatData = await chatResponse.json()
      const newChatId = chatData.chat.id

      // 2. Navigate to the new chat
      router.push(`/chat/${newChatId}?initialMessage=${encodeURIComponent(input)}`)
    } catch (error) {
      console.error("Error creating chat:", error)
      alert("Failed to create chat. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleQuickStart = (promptText: string) => {
    setInput(promptText)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleCreateChat(e)
    }
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          session={session}
          conversation={[]}
          onNewChat={() => {
            setInput("")
          }}
          images={uploadedImages}
          onImagesChange={setUploadedImages}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId=""
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-semibold mb-3">Create Amazing Email Templates</h2>
            <p className="text-muted-foreground mb-8 text-lg lg:text-xl max-w-2xl">
              Describe the email template you need, and I'll generate professional, responsive HTML for you. I'll
              remember our conversation and can iterate on previous designs.
            </p>
          </div>

          {/* Centered Input Area */}
          <div className="w-full max-w-2xl mb-8">
            <form onSubmit={handleCreateChat}>
              <div className="relative bg-background border border-border/60 rounded-2xl shadow-lg overflow-hidden">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the email template you want to create..."
                  className="min-h-[100px] max-h-[300px] resize-none border-0 bg-transparent text-lg p-4 pr-16 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="absolute right-3 bottom-3">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!input.trim() || isCreating}
                    className="rounded-xl shadow-md h-12 w-12 p-0"
                  >
                    {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </form>

            {/* Status indicators */}
            <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Memory enabled</span>
              </div>
              {uploadedImages.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {uploadedImages.length} image{uploadedImages.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Start Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-4xl">
            <Button
              variant="outline"
              className="justify-start text-left h-auto p-4 hover:shadow-md transition-all"
              onClick={() => handleQuickStart("Create a modern newsletter template with a hero section")}
            >
              <div className="text-left">
                <div className="font-medium text-base">📧 Newsletter template</div>
                <div className="text-sm text-muted-foreground">with hero section</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start text-left h-auto p-4 hover:shadow-md transition-all"
              onClick={() => handleQuickStart("Design a welcome email for new users")}
            >
              <div className="text-left">
                <div className="font-medium text-base">👋 Welcome email</div>
                <div className="text-sm text-muted-foreground">for new users</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start text-left h-auto p-4 hover:shadow-md transition-all"
              onClick={() => handleQuickStart("Generate a professional invoice email template")}
            >
              <div className="text-left">
                <div className="font-medium text-base">💼 Invoice template</div>
                <div className="text-sm text-muted-foreground">professional design</div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
