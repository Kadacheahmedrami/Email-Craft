"use client"

import { useState, createContext, useContext } from "react"
import { Sidebar } from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"

// Create context for chat layout state
interface ChatLayoutContextType {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  uploadedImages: any[]
  setUploadedImages: (images: any[]) => void
}

const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null)

export const useChatLayout = () => {
  const context = useContext(ChatLayoutContext)
  if (!context) {
    throw new Error("useChatLayout must be used within ChatLayoutClient")
  }
  return context
}

interface ChatLayoutClientProps {
  children: React.ReactNode
  session: { user: { name?: string; email?: string } }
}

export function ChatLayoutClient({ children, session }: ChatLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [uploadedImages, setUploadedImages] = useState<any[]>([])

  const contextValue = {
    sidebarOpen,
    setSidebarOpen,
    uploadedImages,
    setUploadedImages,
  }

  return (
    <ThemeProvider>
      <ChatLayoutContext.Provider value={contextValue}>
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            session={session}
            conversation={[]} // This will be overridden by individual pages
            onNewChat={() => {}} // This will be overridden by individual pages
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />

          {/* Main Content */}
          <div className="flex-1 flex min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
      </ChatLayoutContext.Provider>
    </ThemeProvider>
  )
}