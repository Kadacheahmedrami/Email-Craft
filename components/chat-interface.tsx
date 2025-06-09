"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Send,
  Loader2,
  User,
  Bot,
  Copy,
  Download,
  Sparkles,
  Menu,
  Trash2,
  ImageIcon,
  ArrowDown,
  CheckCircle2,
} from "lucide-react"

interface Message {
  id: string
  role: "USER" | "AI"
  content: string
  generatedTemplate?: string
  createdAt: string
  metadata?: any
}

interface ChatInterfaceProps {
  conversation: Message[]
  onConversationChange: (msgs: Message[]) => void
  currentTemplate: string
  onTemplateChange: (template: string) => void
  uploadedImages: any[]
  isGenerating: boolean
  onGeneratingChange: (generating: boolean) => void
  sidebarOpen: boolean
  onSidebarToggle: () => void
  chatId: string
}

export function ChatInterface({
  conversation,
  onConversationChange,
  currentTemplate,
  onTemplateChange,
  uploadedImages,
  isGenerating,
  onGeneratingChange,
  sidebarOpen,
  onSidebarToggle,
  chatId,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [chatTitle, setChatTitle] = useState("New Chat")
  const [imageCount, setImageCount] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Update image count when uploadedImages changes
  useEffect(() => {
    setImageCount(uploadedImages?.length || 0)
  }, [uploadedImages])

  // Enhanced auto-scroll functionality
  const scrollToBottom = useCallback(
    (force = false) => {
      if (messagesEndRef.current && (isAtBottom || force)) {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        })
      }
    },
    [isAtBottom],
  )

  // Monitor scroll position
  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const threshold = 100
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold

    setIsAtBottom(atBottom)
    setShowScrollButton(!atBottom && conversation.length > 0)
  }, [conversation.length])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (conversation.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom(true)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [conversation.length, scrollToBottom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isGenerating) return

    const userMessageContent = input.trim()
    setInput("")
    onGeneratingChange(true)

    // Optimistically add user message to UI
    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: "USER",
      content: userMessageContent,
      createdAt: new Date().toISOString(),
    }

    const updatedConversation = [...conversation, tempUserMessage]
    onConversationChange(updatedConversation)

    try {
      // Add user message to database
      const userMessageResponse = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "USER",
          content: userMessageContent,
        }),
      })

      const userMessageData = await userMessageResponse.json()
      if (userMessageResponse.ok && userMessageData.success && userMessageData.message) {
        // Replace temp message with real one
        const conversationWithRealUser = updatedConversation.map((msg) =>
          msg.id === tempUserMessage.id ? userMessageData.message : msg,
        )
        onConversationChange(conversationWithRealUser)
      }

      // Generate AI response
      const aiResponse = await fetch("/api/email-styler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageContent,
          conversation: conversation,
          sessionId: chatId,
          maintainMemory: true,
          latestTemplate: currentTemplate,
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

        // CRITICAL FIX: Update template immediately when AI responds
        if (aiData.template) {
          onTemplateChange(aiData.template)
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
          onConversationChange(finalConversation)

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
          const fallbackMessage: Message = {
            id: `ai-${Date.now()}`,
            role: "AI",
            content: aiMessageContent,
            generatedTemplate: aiData.template,
            createdAt: new Date().toISOString(),
            metadata: aiData.metadata || {},
          }
          const finalConversation = [...updatedConversation, fallbackMessage]
          onConversationChange(finalConversation)
        }
      } else {
        throw new Error(aiData.error || "Failed to generate template")
      }
    } catch (error) {
      console.error("Error generating template:", error)

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "AI",
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
          onConversationChange(finalConversation)
        } else {
          const finalConversation = [...updatedConversation, errorMessage]
          onConversationChange(finalConversation)
        }
      } catch (saveError) {
        console.warn("Failed to save error message:", saveError)
        const finalConversation = [...updatedConversation, errorMessage]
        onConversationChange(finalConversation)
      }
    } finally {
      onGeneratingChange(false)
    }
  }

  const clearConversation = async () => {
    try {
      // Clear UI immediately for better UX
      onConversationChange([])
      onTemplateChange("")

      // Delete all messages for this chat
      const messageIds = conversation.map((m) => m.id).filter((id) => !id.startsWith("temp-"))
      if (messageIds.length > 0) {
        await Promise.allSettled(
          messageIds.map((id) =>
            fetch(`/api/messages/${id}`, {
              method: "DELETE",
            }),
          ),
        )
      }

      // Update chat to clear current template
      try {
        await fetch(`/api/chats/${chatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentTemplate: null,
          }),
        })
      } catch (updateError) {
        console.warn("Failed to update chat:", updateError)
      }
    } catch (error) {
      console.error("Error clearing conversation:", error)
    }
  }

  const copyTemplate = async (template: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(template)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (err) {
      console.error("Failed to copy template:", err)
    }
  }

  const downloadTemplate = (template: string, filename = "email-template.html") => {
    try {
      const blob = new Blob([template], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download template:", error)
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
      handleSubmit(e)
    }
  }

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString()
    } catch {
      return "now"
    }
  }

  // Render centered welcome screen with input
  const renderWelcomeScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl lg:text-3xl font-semibold mb-3">Create Amazing Email Templates</h2>
        <p className="text-muted-foreground mb-8 text-lg lg:text-xl max-w-2xl">
          Describe the email template you need, and I'll generate professional, responsive HTML for you. I'll remember
          our conversation and can iterate on previous designs.
        </p>
      </div>

      {/* Centered Input Area */}
      <div className="w-full max-w-2xl mb-8">
        <form onSubmit={handleSubmit}>
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
                disabled={!input.trim() || isGenerating}
                className="rounded-xl shadow-md h-12 w-12 p-0"
              >
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
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
          {imageCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <ImageIcon className="h-3 w-3" />
              {imageCount} image{imageCount !== 1 ? "s" : ""}
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
  )

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center gap-3 p-4 border-b bg-card">
        <Button variant="ghost" size="sm" onClick={onSidebarToggle} className="p-2">
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">{chatTitle}</h1>
        {conversation.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              Memory: ON
            </Badge>
            <Button variant="ghost" size="sm" onClick={clearConversation} className="p-2">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg">{chatTitle}</h1>
          <Badge variant="outline" className="text-xs">
            Chat: {chatId.substring(0, 8)}...
          </Badge>
        </div>
        {conversation.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              Memory: ON
            </Badge>
            <Button variant="ghost" size="sm" onClick={clearConversation} className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Clear Chat
            </Button>
          </div>
        )}
      </div>

      {/* Content Area */}
      {conversation.length === 0 ? (
        renderWelcomeScreen()
      ) : (
        <>
          {/* Chat Messages */}
          <div className="flex-1 relative overflow-hidden">
            <ScrollArea className="h-full p-3 sm:p-4 lg:p-6" ref={scrollAreaRef} onScrollCapture={handleScroll}>
              <div className="space-y-6 max-w-4xl mx-auto pb-4">
                {conversation.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 lg:gap-4 ${message.role === "USER" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`flex gap-3 max-w-[90%] sm:max-w-[85%] lg:max-w-[80%] ${message.role === "USER" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === "USER"
                            ? "bg-primary text-primary-foreground"
                            : "bg-gradient-to-br from-purple-500 to-blue-600 text-white"
                        }`}
                      >
                        {message.role === "USER" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>

                      {/* Message Content */}
                      <div
                        className={`rounded-xl p-3 lg:p-4 ${
                          message.role === "USER"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted border border-border/50"
                        }`}
                      >
                        <p className="text-base leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>

                        {/* Timestamp */}
                        <div
                          className={`text-sm mt-2 ${message.role === "USER" ? "opacity-70" : "text-muted-foreground"}`}
                        >
                          {formatTime(message.createdAt)}
                        </div>

                        {/* Template Actions */}
                        {message.generatedTemplate && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => copyTemplate(message.generatedTemplate!, message.id)}
                              className="h-8"
                            >
                              {copiedMessageId === message.id ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Copied!</span>
                                  <span className="sm:hidden">✓</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Copy HTML</span>
                                  <span className="sm:hidden">Copy</span>
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                downloadTemplate(message.generatedTemplate!, `email-template-${Date.now()}.html`)
                              }
                              className="h-8"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">Download</span>
                              <span className="sm:hidden">Save</span>
                            </Button>
                            {message.generatedTemplate === currentTemplate && (
                              <Badge variant="outline" className="text-xs h-8 px-2">
                                Current Template
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isGenerating && (
                  <div className="flex gap-3 lg:gap-4 justify-start animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-3 max-w-[85%] lg:max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-xl p-3 lg:p-4 bg-muted border border-border/50">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div
                              className="w-2 h-2 bg-primary rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-primary rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-primary rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                          <span className="text-base text-muted-foreground">Generating your email template...</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Using conversation context for better results
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <Button
                onClick={() => scrollToBottom(true)}
                size="sm"
                className="absolute bottom-4 right-4 rounded-full w-10 h-10 p-0 shadow-lg z-10 animate-in slide-in-from-bottom-2"
                variant="secondary"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Bottom Input Area */}
          <div className="border-t p-4 bg-card flex-shrink-0">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="relative bg-background border border-border/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Continue the conversation or ask me to modify the template..."
                    className="min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent text-lg p-4 pr-16 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isGenerating}
                  />

                  <div className="absolute right-3 bottom-3">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={!input.trim() || isGenerating}
                      className="rounded-lg shadow-sm h-10 w-10 p-0"
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/20">
                  <div className="flex items-center gap-2">
                    {imageCount > 0 && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        {imageCount}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">Press Enter to send, Shift+Enter for new line</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Chat: {chatId.substring(0, 8)}...</div>
                </div>
              </div>

              <div className="sm:hidden flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {imageCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      {imageCount} image{imageCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge variant="default" className="text-xs">
                    Memory ON
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">Chat: {chatId.substring(0, 8)}...</div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
