"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  ArrowLeft, Send, Plus, Trash2, Mail, Users, AlertCircle, 
  CheckCircle2, Loader2, Paperclip, Eye, Monitor, Smartphone
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Recipient {
  id: string
  email: string
}

interface EmailAttachment {
  id: string
  name: string
  url: string
  size: number
  type: string
}

interface SendEmailClientProps {
  chatId: string
}

function SendEmailClient({ chatId }: SendEmailClientProps) {
  const router = useRouter()
  
  // Consolidated state
  const [state, setState] = useState({
    subject: "",
    senderName: "",
    recipients: [{ id: "recipient_" + Date.now(), email: "" }] as Recipient[],
    attachments: [] as EmailAttachment[],
    template: "",
    isLoading: true,
    isSending: false,
    sendStatus: "idle" as "idle" | "success" | "error",
    errorMessage: "",
    chatImages: [] as any[],
    previewMode: "desktop" as "desktop" | "mobile",
    chatTitle: "Email Template"
  })

  // Load chat data
  useEffect(() => {
    const fetchChatData = async () => {
      try {
        const [chatResponse, imagesResponse] = await Promise.all([
          fetch(`/api/chats/${chatId}`),
          fetch(`/api/chats/${chatId}/images`)
        ])
        
        const [chatData, imagesData] = await Promise.all([
          chatResponse.json(),
          imagesResponse.json()
        ])

        if (!chatData.success) throw new Error("Chat not found")

        setState(prev => ({
          ...prev,
          template: chatData.chat.currentTemplate || "",
          subject: `${chatData.chat.title} - Email Template`,
          senderName: "EmailCraft User",
          chatTitle: chatData.chat.title,
          chatImages: imagesData.success ? imagesData.images || [] : [],
          isLoading: false
        }))
      } catch (error) {
        setState(prev => ({ ...prev, errorMessage: "Failed to load chat data", isLoading: false }))
      }
    }
    fetchChatData()
  }, [chatId])

  // Update state helper
  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates, errorMessage: "" }))
  }

  // Recipient management
  const handleRecipientChange = (id: string, email: string) => {
    updateState({
      recipients: state.recipients.map(r => r.id === id ? { ...r, email } : r)
    })
  }

  const addRecipient = () => {
    updateState({
      recipients: [...state.recipients, { id: "recipient_" + Date.now(), email: "" }]
    })
  }

  const removeRecipient = (id: string) => {
    if (state.recipients.length > 1) {
      updateState({
        recipients: state.recipients.filter(r => r.id !== id)
      })
    }
  }

  // Attachment management
  const toggleAttachment = (image: any) => {
    const isAttached = state.attachments.some(att => att.id === image.id)
    const newAttachments = isAttached
      ? state.attachments.filter(att => att.id !== image.id)
      : [...state.attachments, {
          id: image.id,
          name: image.originalName,
          url: image.url,
          size: image.size,
          type: image.mimeType
        }]
    
    updateState({ attachments: newAttachments })
  }

  // Form validation
  const validateForm = () => {
    if (!state.subject.trim()) return "Subject is required"
    if (!state.senderName.trim()) return "Sender name is required"
    if (!state.template.trim()) return "No email template found"
    if (!state.recipients.some(r => r.email.trim() && r.email.includes("@"))) {
      return "At least one valid recipient email is required"
    }
    return null
  }

  // Send email
  const handleSendEmail = async () => {
    const error = validateForm()
    if (error) {
      setState(prev => ({ ...prev, errorMessage: error }))
      return
    }

    setState(prev => ({ ...prev, isSending: true, sendStatus: "idle", errorMessage: "" }))

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          subject: state.subject,
          senderName: state.senderName,
          recipients: state.recipients.filter(r => r.email.trim()).map(r => ({ email: r.email })),
          template: state.template,
          attachments: state.attachments
        })
      })

      const data = await response.json()

      if (data.success) {
        setState(prev => ({ ...prev, sendStatus: "success" }))
        setTimeout(() => router.push(`/chat/${chatId}`), 2000)
      } else {
        setState(prev => ({ 
          ...prev, 
          sendStatus: "error", 
          errorMessage: data.details || data.error || "Failed to send email" 
        }))
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        sendStatus: "error", 
        errorMessage: "Network error. Please try again." 
      }))
    } finally {
      setState(prev => ({ ...prev, isSending: false }))
    }
  }

  // Utility functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getPreviewDimensions = () => ({
    width: state.previewMode === "mobile" ? "375px" : "600px",
    maxWidth: state.previewMode === "mobile" ? "375px" : "600px"
  })

  if (state.isLoading) {
    return (
      <ThemeProvider>
        <div className="h-screen bg-background flex items-center w-full justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <div>
              <h3 className="font-semibold text-lg">Loading Email Template</h3>
              <p className="text-muted-foreground">Preparing your email...</p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="h-screen bg-background flex w-full flex-col">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/chat/${chatId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Editor
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-semibold">Send Email</h1>
                  <p className="text-sm text-muted-foreground">{state.chatTitle}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              
              {/* Status */}
              {state.sendStatus === "success" && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Email sent!</span>
                </div>
              )}
              
              {state.sendStatus === "error" && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Failed to send</span>
                </div>
              )}

              <Button onClick={handleSendEmail} disabled={state.isSending} className="gap-2 min-w-[120px]">
                {state.isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Form Panel */}
          <div className="w-[400px] border-r bg-background overflow-auto">
            <div className="p-6 space-y-6">
              {/* Email Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Email Details</h2>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={state.subject}
                      onChange={(e) => updateState({ subject: e.target.value })}
                      placeholder="Enter subject"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="senderName">Sender Name</Label>
                    <Input
                      id="senderName"
                      value={state.senderName}
                      onChange={(e) => updateState({ senderName: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                </div>
              </div>

              {/* Recipients */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Recipients</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={addRecipient}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {state.recipients.map((recipient) => (
                    <div key={recipient.id} className="flex gap-2">
                      <Input
                        type="email"
                        value={recipient.email}
                        onChange={(e) => handleRecipientChange(recipient.id, e.target.value)}
                        placeholder="email@example.com"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecipient(recipient.id)}
                        disabled={state.recipients.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              {state.chatImages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <h2 className="font-semibold">Attachments</h2>
                    </div>
                    <Badge variant="outline">{state.attachments.length} selected</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {state.chatImages.map((image) => {
                      const isSelected = state.attachments.some(att => att.id === image.id)
                      return (
                        <div
                          key={image.id}
                          className={cn(
                            "border rounded-lg overflow-hidden cursor-pointer transition-all",
                            isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                          )}
                          onClick={() => toggleAttachment(image)}
                        >
                          <div className="aspect-video bg-muted relative">
                            <img
                              src={image.url}
                              alt={image.originalName}
                              className="w-full h-full object-cover"
                            />
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium truncate">{image.originalName}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(image.size)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Error */}
              {state.errorMessage && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{state.errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col bg-muted/20">
            <div className="border-b bg-background p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Preview</h2>
                </div>
                
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <Button
                    size="sm"
                    variant={state.previewMode === "desktop" ? "default" : "ghost"}
                    onClick={() => updateState({ previewMode: "desktop" })}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={state.previewMode === "mobile" ? "default" : "ghost"}
                    onClick={() => updateState({ previewMode: "mobile" })}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-auto">
              <div className="flex justify-center">
                {state.template ? (
                  <div
                    className="bg-white rounded-lg shadow-lg border overflow-hidden"
                    style={getPreviewDimensions()}
                  >
                    <iframe
                      srcDoc={state.template}
                      className="w-full border-0"
                      style={{ height: "600px" }}
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Mail className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-lg font-medium mb-2">No Template Available</p>
                    <p className="text-muted-foreground mb-4">Create a template in the chat first</p>
                    <Button asChild variant="outline">
                      <Link href={`/chat/${chatId}`}>Go to Chat</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default SendEmailClient