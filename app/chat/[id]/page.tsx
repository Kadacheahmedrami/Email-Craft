"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { PreviewPanel } from "@/components/preview-panel"
import { ThemeProvider } from "@/components/theme-provider"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string

  const [currentTemplate, setCurrentTemplate] = useState<string>("")
  const [sidebarOpen, setSidebarOpen] = useState(true)



  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Unified Sidebar - Navigation & Images */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} currentChatId={chatId} />

        {/* Main Content Area */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <ChatInterface
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            chatId={chatId}
          />

          {/* Preview Panel - Responsive behavior */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out",
              currentTemplate ? "opacity-100" : "opacity-0 w-0 border-l-0",
              "hidden md:block", // Hide on mobile, show on medium screens and up
            )}
          >
            <PreviewPanel template={currentTemplate} isVisible={!!currentTemplate} className="h-full" chatId={chatId} />
          </div>
        </div>

        {/* Mobile Preview Button - Only show when there's a template and on mobile */}
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
