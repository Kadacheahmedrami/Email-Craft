// File: NewChatClient.tsx (Client Component)
"use client"

import { useState } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { ThemeProvider } from "@/components/theme-provider"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export function NewChatClient() {
  const params = useParams()
  const router = useRouter()

  const [currentTemplate, setCurrentTemplate] = useState<string>("")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Unified Sidebar - Navigation & Images */}
        
        {/* Main Content Area */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <ChatInterface
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            chatId=""
          />

          {/* Preview Panel - Responsive behavior */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out border-l",
              currentTemplate 
                ? "opacity-100 w-80" 
                : "opacity-0 w-0 border-l-0",
              "hidden md:block" // Hide on mobile, show on medium screens and up
            )}
          >
            {/* Add your preview content here */}
            {currentTemplate && (
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2">Template Preview</h3>
                <p>{currentTemplate}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}