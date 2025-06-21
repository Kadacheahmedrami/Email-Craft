"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Mail,
  Search,
  History,
  Settings,
  Moon,
  Sun,
  Upload,
  ImageIcon,
  Download,
  Eye,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  MoreHorizontal,
  Loader2,
  LogOut,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Session } from "next-auth"
import { signOut } from "next-auth/react"

interface Chat {
  id: string
  title: string
  updatedAt: string
  messageCount: number
  imageCount: number
  hasTemplate: boolean
  lastMessage?: {
    content: string
    createdAt: string
    role: string
  }
}

interface ImageFile {
  id: string
  filename: string
  originalName: string
  url: string
  size: number
  mimeType: string
  createdAt: string
}

interface SidebarProps {
  session: { user: { name?: string; email?: string } }
  conversation: any[]
  onNewChat: () => void
  images: any[]
  onImagesChange: (images: any[]) => void
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ 
  session,
  conversation,
  onNewChat,
  images: propsImages,
  onImagesChange,
  isOpen, 
  onToggle
}: SidebarProps) {

  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  
  // Extract chat ID from pathname
  const getCurrentChatId = (): string | null => {
    const pathSegments = pathname.split('/')
    // Check if we're on a chat route with an ID: /chat/[id]
    if (pathSegments.length >= 3 && pathSegments[1] === 'chat' && pathSegments[2]) {
      return pathSegments[2]
    }
    return null
  }

  const currentChatId = getCurrentChatId()
  
  const [activeView, setActiveView] = useState<"conversations" | "images">("conversations")
  const [searchQuery, setSearchQuery] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [conversations, setConversations] = useState<Chat[]>([])
  const [uploadedImages, setUploadedImages] = useState<ImageFile[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  // Load user's chats
  useEffect(() => {
    loadChats()
  }, [])

  // Load images when switching to images view or when currentChatId changes
  useEffect(() => {
    if (activeView === "images" && currentChatId) {
      loadImages()
    }
  }, [activeView, currentChatId])

  // Clear images when no chat is selected
  useEffect(() => {
    if (!currentChatId) {
      setUploadedImages([])
    }
  }, [currentChatId])

  const loadChats = async () => {
    try {
      setIsLoadingChats(true)
      const response = await fetch("/api/chats")
      const data = await response.json()

      if (data.success) {
        setConversations(data.chats)
      }
    } catch (error) {
      console.error("Failed to load chats:", error)
    } finally {
      setIsLoadingChats(false)
    }
  }

  const loadImages = async () => {
    if (!currentChatId) return

    try {
      setIsLoadingImages(true)
      const response = await fetch(`/api/chats/${currentChatId}/images`)
      const data = await response.json()

      if (data.success) {
        setUploadedImages(data.images)
      }
    } catch (error) {
      console.error("Failed to load images:", error)
    } finally {
      setIsLoadingImages(false)
    }
  }

  const createNewChat = async () => {
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Template" }),
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/chat/${data.chat.id}`)
        loadChats() // Refresh the chat list
      }
    } catch (error) {
      console.error("Failed to create chat:", error)
    }
  }

  const uploadToServer = async (file: File) => {
    if (!currentChatId) {
      throw new Error("No active chat selected")
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("chatId", currentChatId)

    // Updated to use consistent API pattern
    const response = await fetch(`/api/chats/${currentChatId}/images`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) throw new Error("Upload failed")

    const data = await response.json()
    return data.image
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!currentChatId) {
        alert("Please select a chat first before uploading images")
        return
      }

      setIsUploading(true)

      try {
        const uploadPromises = acceptedFiles.map(uploadToServer)
        const newImages = await Promise.all(uploadPromises)

        setUploadedImages((prev) => [...newImages, ...prev])
        setActiveView("images")
      } catch (error) {
        console.error("Failed to upload images:", error)
        alert("Failed to upload images. Please try again.")
      } finally {
        setIsUploading(false)
      }
    },
    [currentChatId],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    multiple: true,
    noClick: true,
  })

  const removeImage = async (id: string) => {
    if (!currentChatId) return
    
    try {
      // Updated to use consistent API pattern
      await fetch(`/api/chats/${currentChatId}/images/${id}`, { method: "DELETE" })
      setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    } catch (error) {
      console.error("Failed to delete image:", error)
    }
  }

  const clearAllImages = async () => {
    if (!currentChatId || uploadedImages.length === 0) return

    try {
      // Updated to use consistent API pattern - delete all images for this chat
      await fetch(`/api/chats/${currentChatId}/images`, { method: "DELETE" })
      setUploadedImages([])
    } catch (error) {
      console.error("Failed to clear all images:", error)
      // Fallback: delete individually
      Promise.all(uploadedImages.map((img) => removeImage(img.id)))
    }
  }

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/" })
    } catch (error) {
      console.error("Failed to logout:", error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const getConversationPreview = (chat: Chat) => {
    if (chat.lastMessage) {
      const content = chat.lastMessage.content
      return content.length > 100 ? content.substring(0, 100) + "..." : content
    }
    return "No messages yet"
  }

  const getConversationType = (chat: Chat) => {
    if (chat.hasTemplate) return "Template"
    if (chat.messageCount > 0) return "Active"
    return "New"
  }

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getConversationType(conv).toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredImages = uploadedImages.filter((img) => img.originalName.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={onToggle} />}

      {/* Sidebar Container */}
      <div
        {...getRootProps()}
        className={cn(
          "relative bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r border-border/40 flex flex-col transition-all duration-300 ease-out z-50",
          "lg:relative lg:translate-x-0",
          isOpen
            ? "fixed inset-y-0 left-0 w-80 translate-x-0 shadow-xl"
            : "fixed inset-y-0 left-0 w-80 -translate-x-full lg:w-16 lg:translate-x-0",
          isDragActive && "bg-primary/5 border-primary/50",
        )}
      >
        <input {...getInputProps()} />

        {/* Drag Overlay */}
        {isDragActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium text-primary mb-1">Drop your images here</p>
              <p className="text-sm text-muted-foreground">PNG, JPG, GIF up to 10MB each</p>
              {!currentChatId && <p className="text-xs text-red-500 mt-2">Please select a chat first</p>}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/40 min-h-[73px]">
          {isOpen ? (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="font-semibold text-lg tracking-tight truncate">EmailCraft</h1>
                    <p className="text-xs text-muted-foreground truncate">AI Email Designer</p>
                  </div>
                </Link>
              </div>
              <div className="flex items-center gap-1">
              
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className="h-8 w-8 p-0 hover:bg-muted/50 flex-shrink-0"
                >
                  <PanelLeftClose className="h-8 w-8" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0 hover:bg-muted/50">
                <PanelLeftOpen className="h-8 w-8" />
              </Button>
            </div>
          )}
        </div>

        {/* Content when open */}
        {isOpen && (
          <>
            {/* New Chat Button */}
            <div className="p-4">
              <Button
                onClick={createNewChat}
                className="w-full justify-start gap-3 h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-4 mb-4">
              <div className="flex bg-muted/50 rounded-lg p-1">
                <Button
                  variant={activeView === "conversations" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView("conversations")}
                  className="flex-1 h-8 text-xs font-medium"
                >
                  <History className="h-3 w-3 mr-2" />
                  Chats
                </Button>
                <Button
                  variant={activeView === "images" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView("images")}
                  className="flex-1 h-8 text-xs font-medium relative"
                >
                  <ImageIcon className="h-3 w-3 mr-2" />
                  Images
                  {uploadedImages.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                      {uploadedImages.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={activeView === "conversations" ? "Search conversations..." : "Search images..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeView === "conversations" ? (
                <div className="h-full flex flex-col">
                  {/* Conversations List */}
                  <ScrollArea className="flex-1 px-4 overflow-hidden w-full">
  {isLoadingChats ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : filteredConversations.length === 0 ? (
    <div className="text-center py-8 px-2">
      <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <History className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium mb-1 break-words">
        {searchQuery ? "No matching conversations" : "No conversations yet"}
      </p>
      <p className="text-xs text-muted-foreground break-words">
        {searchQuery ? "Try a different search term" : "Create your first email template"}
      </p>
    </div>
  ) : (
    <div className="flex flex-col gap-2 pb-4 w-full">
      {filteredConversations.map((conv) => (
        <Link key={conv.id} href={`/chat/${conv.id}`} className="block w-full">
          <div
            className={cn(
              "group p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-card hover:border-border/60 cursor-pointer transition-all duration-200 w-full max-w-full overflow-hidden",
              currentChatId === conv.id && "bg-primary/10 border-primary/30",
            )}
          >
            {/* Header with title and actions */}
            <div className="flex items-start gap-2 mb-2 w-full min-w-0">
              <h3 className="font-medium text-sm flex-1 min-w-0 break-words hyphens-auto leading-tight">
                {conv.title}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 whitespace-nowrap text-[10px] leading-none">
                  {getConversationType(conv)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {/* Preview text */}
            <div className="mb-2 w-full overflow-hidden">
              <p className="text-xs text-muted-foreground break-words overflow-hidden leading-relaxed">
                <span className="line-clamp-2 display-block">
                  {getConversationPreview(conv)}
                </span>
              </p>
            </div>
            
            {/* Footer with timestamp and stats */}
            <div className="flex items-center justify-between w-full min-w-0 gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1 min-w-0">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-[10px]">
                  {formatTimeAgo(conv.updatedAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                {conv.messageCount > 0 && (
                  <span className="whitespace-nowrap text-[10px]">
                    {conv.messageCount}m
                  </span>
                )}
                {conv.imageCount > 0 && (
                  <span className="whitespace-nowrap text-[10px]">
                    {conv.imageCount}i
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )}
</ScrollArea>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Image Upload Area */}
                  <div className="px-4 mb-4">
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200",
                        "hover:border-primary/50 hover:bg-primary/5",
                        isDragActive ? "border-primary bg-primary/5" : "border-border/40",
                        isUploading && "opacity-50 pointer-events-none",
                        !currentChatId && "opacity-50 cursor-not-allowed",
                      )}
                      onClick={() => {
                        if (currentChatId) {
                          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
                          if (fileInput) {
                            fileInput.click()
                          }
                        }
                      }}
                    >
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                        <Upload className={cn("h-5 w-5 text-muted-foreground", isUploading && "animate-pulse")} />
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {isUploading ? "Uploading..." : currentChatId ? "Upload Images" : "Select a chat first"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentChatId ? "Drag & drop or click to browse" : "Images are linked to specific chats"}
                      </p>
                    </div>
                  </div>

                  {/* Images List */}
                  <ScrollArea className="flex-1 px-4">
                    {isLoadingImages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !currentChatId ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium mb-1">Select a chat to view images</p>
                        <p className="text-xs text-muted-foreground">Images are organized by conversation</p>
                      </div>
                    ) : filteredImages.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium mb-1">
                          {searchQuery ? "No matching images" : "No images in this chat"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery ? "Try a different search term" : "Upload images to use in your templates"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 pb-4">
                        {filteredImages.map((image) => (
                          <div
                            key={image.id}
                            className="group border border-border/40 rounded-lg p-3 bg-card/50 hover:bg-card hover:border-border/60 transition-all duration-200"
                          >
                            {/* Image Preview */}
                            <div className="aspect-video bg-muted/50 rounded-md mb-3 overflow-hidden">
                              <img
                                src={image.url || "/placeholder.svg"}
                                alt={image.originalName}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Image Info */}
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{image.originalName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(image.size)} • {image.mimeType.split("/")[1].toUpperCase()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatTimeAgo(image.createdAt)}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeImage(image.id)}
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" className="h-7 px-2 flex-1 text-xs">
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 flex-1 text-xs">
                                  <Download className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Clear All Button */}
                  {uploadedImages.length > 0 && (
                    <div className="p-4 border-t border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllImages}
                        className="w-full h-8 text-xs"
                      >
                        Clear All Images
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/40">
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-8 px-2 text-xs"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {theme === "dark" ? "Light" : "Dark"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
              
              {/* User Info and Logout */}
              <div className="space-y-2">
                {session?.user && (
                  <div className="text-xs text-muted-foreground text-center truncate px-2">
                    {session.user.email || session.user.name}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                >
                  <LogOut className="h-3 w-3 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Collapsed State */}
        {!isOpen && (
          <div className="flex-1 flex flex-col items-center py-4 space-y-3">
            <Separator className="w-6" />

            <Button variant="ghost" size="sm" onClick={createNewChat} className="w-10 h-10 p-0 rounded-lg">
              <Plus className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 p-0 rounded-lg"
              onClick={() => setActiveView("conversations")}
            >
              <History className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 p-0 rounded-lg relative"
              onClick={() => setActiveView("images")}
            >
              <ImageIcon className="h-5 w-5" />
              {uploadedImages.length > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                  {uploadedImages.length}
                </Badge>
              )}
            </Button>

            <div className="flex-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-10 h-10 p-0 rounded-lg"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-10 h-10 p-0 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  )
}