"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  ImageIcon,
  Mail,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Paperclip,
  Eye,
  Monitor,
  Smartphone,
  Upload,
  FileText,
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

interface SendEmailFormData {
  subject: string
  senderName: string
  senderEmail: string
  recipients: Recipient[]
  attachments: EmailAttachment[]
  template: string
}

interface ChatImage {
  id: string
  filename: string
  originalName: string
  url: string
  size: number
  mimeType: string
}

interface SendEmailClientProps {
  chatId: string
}

function SendEmailClient({ chatId }: SendEmailClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<SendEmailFormData>({
    subject: "",
    senderName: "",
    senderEmail: "",
    recipients: [{ id: "recipient_" + Date.now(), email: "" }],
    attachments: [],
    template: "",
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [chatImages, setChatImages] = useState<ChatImage[]>([])
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [chatTitle, setChatTitle] = useState("Email Template")

  // Load email template and chat data
  useEffect(() => {
    fetchChatData()
  }, [chatId])

  const fetchChatData = async () => {
    try {
      setIsLoading(true)

      // Load chat data including template and images
      const chatResponse = await fetch(`/api/chats/${chatId}`)
      const chatData = await chatResponse.json()

      if (!chatData.success) {
        throw new Error("Chat not found")
      }

      const chat = chatData.chat
      setChatTitle(chat.title)

      // Load chat images
      const imagesResponse = await fetch(`/api/chats/${chatId}/images`)
      const imagesData = await imagesResponse.json()

      if (imagesData.success) {
        setChatImages(imagesData.images || [])
      }

      // Set form data with chat template and default user info
      setFormData((prev) => ({
        ...prev,
        template: chat.currentTemplate || "",
        subject: `${chat.title} - Email Template`,
        senderName: "EmailCraft User",
        senderEmail: "user@example.com",
      }))

      setIsLoading(false)
    } catch (error) {
      console.error("Error loading chat data:", error)
      setErrorMessage("Failed to load chat data")
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof SendEmailFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errorMessage) setErrorMessage("")
  }

  const handleRecipientChange = (id: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      recipients: prev.recipients.map((recipient) =>
        recipient.id === id ? { ...recipient, email: value } : recipient,
      ),
    }))
    if (errorMessage) setErrorMessage("")
  }

  const addRecipient = () => {
    setFormData((prev) => ({
      ...prev,
      recipients: [...prev.recipients, { id: "recipient_" + Date.now(), email: "" }],
    }))
  }

  const removeRecipient = (id: string) => {
    if (formData.recipients.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((recipient) => recipient.id !== id),
    }))
  }

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split("\n").filter((line) => line.trim())
      const emails: string[] = []

      lines.forEach((line) => {
        const parts = line.split(",").map((part) => part.trim().replace(/"/g, ""))
        parts.forEach((part) => {
          if (part.includes("@") && part.includes(".")) {
            emails.push(part)
          }
        })
      })

      if (emails.length > 0) {
        const newRecipients = emails.map((email) => ({
          id: "recipient_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          email: email,
        }))

        setFormData((prev) => ({
          ...prev,
          recipients: newRecipients,
        }))
      }
    }
    reader.readAsText(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const toggleAttachment = (image: ChatImage) => {
    const isAttached = formData.attachments.some((att) => att.id === image.id)

    if (isAttached) {
      setFormData((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((att) => att.id !== image.id),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            id: image.id,
            name: image.originalName,
            url: image.url,
            size: image.size,
            type: image.mimeType,
          },
        ],
      }))
    }
  }

  const validateForm = () => {
    if (!formData.subject.trim()) {
      setErrorMessage("Subject is required")
      return false
    }

    if (!formData.senderEmail.trim() || !formData.senderName.trim()) {
      setErrorMessage("Sender name and email are required")
      return false
    }

    if (!formData.template.trim()) {
      setErrorMessage("No email template found. Please create a template first.")
      return false
    }

    const hasValidRecipient = formData.recipients.some((r) => r.email.trim() !== "" && r.email.includes("@"))

    if (!hasValidRecipient) {
      setErrorMessage("At least one valid recipient email is required")
      return false
    }

    return true
  }

  const handleSendEmail = async () => {
    if (!validateForm()) return

    setIsSending(true)
    setSendStatus("idle")
    setErrorMessage("")

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          chatId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSendStatus("success")
        setTimeout(() => {
          router.push(`/chat/${chatId}`)
        }, 3000)
      } else {
        setSendStatus("error")
        setErrorMessage(data.details || data.error || "Failed to send email")
      }
    } catch (error) {
      console.error("Error sending email:", error)
      setSendStatus("error")
      setErrorMessage("Network error. Please check your connection and try again.")
    } finally {
      setIsSending(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getPreviewEmailHeader = () => {
    const validRecipients = formData.recipients.filter((r) => r.email.trim())
    const recipientText = validRecipients.length > 0 ? validRecipients.map((r) => r.email).join(", ") : "No recipients"

    return {
      from: `${formData.senderName || "Sender"} <${formData.senderEmail || "sender@email.com"}>`,
      to: recipientText,
      subject: formData.subject || "No subject",
    }
  }

  const getPreviewDimensions = () => {
    switch (previewMode) {
      case "mobile":
        return { width: "375px", maxWidth: "375px" }
      case "desktop":
      default:
        return { width: "600px", maxWidth: "600px" }
    }
  }

  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Loading Email Template</h3>
              <p className="text-muted-foreground">Preparing your email for sending...</p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  const previewHeader = getPreviewEmailHeader()
  const previewDimensions = getPreviewDimensions()

  return (
    <ThemeProvider>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="gap-2">
                <Link href={`/chat/${chatId}`}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to Editor
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-semibold">Send Email</h1>
                  <p className="text-sm text-muted-foreground">{chatTitle}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />

              {/* Status Indicator */}
              {sendStatus === "success" && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Email sent successfully!</span>
                </div>
              )}
              {sendStatus === "error" && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Failed to send</span>
                </div>
              )}

              {/* Send Button */}
              <Button onClick={handleSendEmail} disabled={isSending} className="gap-2 min-w-[140px]" size="default">
                {isSending ? (
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel - Form */}
          <div className="w-full lg:w-[500px] flex-shrink-0 border-r bg-background overflow-auto">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-6 space-y-6">
                {/* Email Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="font-semibold text-lg">Email Details</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium">
                        Subject Line
                      </Label>
                      <Input
                        id="subject"
                        placeholder="Enter a compelling subject line"
                        value={formData.subject}
                        onChange={(e) => handleInputChange("subject", e.target.value)}
                        className="h-11 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="senderName" className="text-sm font-medium">
                        Sender Name
                      </Label>
                      <Input
                        id="senderName"
                        placeholder="Your Name or Company"
                        value={formData.senderName}
                        onChange={(e) => handleInputChange("senderName", e.target.value)}
                        className="h-11 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="senderEmail" className="text-sm font-medium">
                        Sender Email
                      </Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.senderEmail}
                        onChange={(e) => handleInputChange("senderEmail", e.target.value)}
                        className="h-11 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="text-xs text-muted-foreground">Enter your email address for sending</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Recipients */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <h2 className="font-semibold text-lg">Recipients</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCSVImport}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-1"
                      >
                        <Upload className="h-3 w-3" />
                        Import CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={addRecipient} className="gap-1">
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {formData.recipients.map((recipient, index) => (
                      <div key={recipient.id} className="group">
                        <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-border hover:shadow-sm transition-all">
                          <div className="flex-1">
                            <Input
                              placeholder="Email Address"
                              type="email"
                              value={recipient.email}
                              onChange={(e) => handleRecipientChange(recipient.id, e.target.value)}
                              className="h-10"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(recipient.id)}
                            disabled={formData.recipients.length <= 1}
                            className="h-10 w-10 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                    <span>
                      {formData.recipients.length} recipient{formData.recipients.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1 text-xs">
                      <FileText className="h-3 w-3" />
                      <span>CSV format: email1@domain.com, email2@domain.com</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Attachments */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Paperclip className="h-4 w-4 text-primary" />
                      </div>
                      <h2 className="font-semibold text-lg">Attachments</h2>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formData.attachments.length} selected
                    </Badge>
                  </div>

                  {chatImages.length === 0 ? (
                    <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
                      <ImageIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-muted-foreground">No images available</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Upload images in the chat to attach them</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {chatImages.map((image) => {
                        const isSelected = formData.attachments.some((att) => att.id === image.id)
                        return (
                          <div
                            key={image.id}
                            className={cn(
                              "border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md",
                              isSelected
                                ? "border-primary ring-2 ring-primary/20 shadow-sm"
                                : "border-border hover:border-primary/50",
                            )}
                            onClick={() => toggleAttachment(image)}
                          >
                            <div className="aspect-video bg-muted relative">
                              <img
                                src={image.url || "/placeholder.svg"}
                                alt={image.originalName}
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-medium truncate">{image.originalName}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(image.size)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/30">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col bg-muted/20 min-h-[50vh] lg:min-h-0">
            {/* Preview Header */}
            <div className="flex-shrink-0 border-b bg-background p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Eye className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-lg">Live Preview</h2>
                </div>

                {/* Preview Mode Toggle */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <Button
                    size="sm"
                    variant={previewMode === "desktop" ? "default" : "ghost"}
                    onClick={() => setPreviewMode("desktop")}
                    className="h-8 px-3"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "mobile" ? "default" : "ghost"}
                    onClick={() => setPreviewMode("mobile")}
                    className="h-8 px-3"
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Email Header Preview */}
              <Card className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate flex-1 mr-4">From: {previewHeader.from}</div>
                    <Badge variant="secondary" className="text-xs">
                      Preview
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">To: {previewHeader.to}</div>
                  <div className="text-sm font-medium">Subject: {previewHeader.subject}</div>
                  {formData.attachments.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {formData.attachments.slice(0, 3).map((att) => (
                          <Badge key={att.id} variant="outline" className="text-xs">
                            {att.name}
                          </Badge>
                        ))}
                        {formData.attachments.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{formData.attachments.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Preview Content */}
            <div className="flex-1 p-4 sm:p-6 overflow-auto">
              <div className="h-full flex items-start justify-center">
                {formData.template ? (
                  <div
                    className="bg-white rounded-xl shadow-lg border overflow-hidden transition-all duration-300 mx-auto"
                    style={{
                      width: previewDimensions.width,
                      maxWidth: previewDimensions.maxWidth,
                      minHeight: "400px",
                      height: "auto",
                    }}
                  >
                    <iframe
                      srcDoc={formData.template}
                      className="w-full border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                      style={{
                        height: "600px",
                        minHeight: "400px",
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium mb-2">No Template Available</p>
                    <p className="text-muted-foreground mb-4">Please create an email template in the chat first</p>
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
