"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Monitor,
  Smartphone,
  Code,
  Eye,
  Copy,
  Send,
  Maximize2,
  Minimize2,
  GripVertical,
  RotateCcw,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

interface PreviewPanelProps {
  template: string
  isVisible: boolean
  className?: string
  chatId?: string
}

export function PreviewPanel({ template, isVisible, className, chatId }: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop")
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview")
  const [panelWidth, setPanelWidth] = useState(600)
  const [isResizing, setIsResizing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const MIN_WIDTH = 300
  const MAX_WIDTH = 1000
  const DEFAULT_WIDTH = 600

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return

      const panelRect = panelRef.current.getBoundingClientRect()
      const newWidth = panelRect.right - e.clientX
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
      setPanelWidth(clampedWidth)
    },
    [isResizing],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Save template to localStorage when it changes
  useEffect(() => {
    if (template && chatId) {
      localStorage.setItem(`template_${chatId}`, template)
    }
  }, [template, chatId])

  const getPreviewScale = () => {
    const contentWidth = panelWidth - 32 // Account for padding
    switch (viewMode) {
      case "mobile":
        return Math.min(1, contentWidth / 375) // iPhone width
      case "desktop":
      default:
        return Math.min(1, contentWidth / 600) // Standard email width
    }
  }

  const getPreviewDimensions = () => {
    const contentWidth = panelWidth - 32 // Account for padding
    const maxPreviewWidth = Math.min(contentWidth, 800) // Cap the preview width

    switch (viewMode) {
      case "mobile":
        return {
          width: Math.min(375, contentWidth),
          height: "600px",
          maxWidth: "375px",
        }
      case "desktop":
      default:
        return {
          width: Math.min(600, maxPreviewWidth), // Standard email width, but allow it to grow
          height: "auto",
          maxWidth: "100%",
        }
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(template)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const resetWidth = () => {
    setPanelWidth(DEFAULT_WIDTH)
  }

  const navigateToSendPage = () => {
    if (chatId) {
      router.push(`/chat/${chatId}/send`)
    }
  }

  if (!isVisible) {
    return (
      <div className={cn("w-96 border-l bg-muted/20 flex items-center justify-center", className)}>
        <div className="text-center p-8">
          <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">Template preview will appear here</p>
        </div>
      </div>
    )
  }

  const previewDimensions = getPreviewDimensions()

  // Tab transition variants for award-winning effects
  const tabContentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: {
        duration: 0.2,
      },
    },
  }

  // Device frame variants
  const deviceFrameVariants = {
    desktop: {
      width: previewDimensions.width,
      height: viewMode === "desktop" ? "auto" : previewDimensions.height,
      borderRadius: "0.75rem",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    mobile: {
      width: "375px",
      height: "600px",
      borderRadius: "1.5rem",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col relative",
        className,
        isMinimized ? "w-12 sm:w-16" : "",
      )}
      style={{ width: isMinimized ? (window.innerWidth < 640 ? 48 : 64) : panelWidth }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 bg-border/40 hover:bg-primary/50 cursor-col-resize transition-colors z-10 group",
          isResizing && "bg-primary/50",
          isMinimized && "hidden",
        )}
      >
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
          <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary/70 transition-colors rotate-90" />
        </div>
      </div>

      {isMinimized ? (
        /* Minimized State */
        <div className="flex flex-col items-center py-4 h-full">
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(false)} className="w-8 h-8 p-0 mb-4">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center">
            <div className="writing-mode-vertical text-xs text-muted-foreground font-medium tracking-wider">
              PREVIEW
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-border/40 flex-shrink-0">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">Preview</h3>
                <Badge variant="secondary" className="text-xs">
                  Live
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={resetWidth} className="h-7 w-7 p-0" title="Reset width">
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-7 w-7 p-0"
                  title="Minimize"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
              <Button
                size="sm"
                variant={viewMode === "desktop" ? "default" : "ghost"}
                onClick={() => setViewMode("desktop")}
                className="flex-1 h-7 text-xs"
                title="Desktop view"
              >
                <Monitor className="h-3 w-3 mr-1.5" />
                <span>Desktop</span>
              </Button>
              <Button
                size="sm"
                variant={viewMode === "mobile" ? "default" : "ghost"}
                onClick={() => setViewMode("mobile")}
                className="flex-1 h-7 text-xs"
                title="Mobile view"
              >
                <Smartphone className="h-3 w-3 mr-1.5" />
                <span>Mobile</span>
              </Button>
            </div>

            {/* Width indicator */}
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {panelWidth}px • {Math.round(getPreviewScale() * 100)}% scale
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as any)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-2 flex-shrink-0 h-8">
              <TabsTrigger value="preview" className="flex items-center gap-2 text-xs">
                <Eye className="h-3 w-3" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2 text-xs">
                <Code className="h-3 w-3" />
                Code
              </TabsTrigger>
            </TabsList>

            {/* Animated Tab Content */}
            <div className="flex-1 p-2 sm:p-4 min-h-0 relative">
              <AnimatePresence mode="wait">
                {activeTab === "preview" ? (
                  <motion.div
                    key="preview"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={tabContentVariants}
                    className="h-full flex items-start justify-center overflow-auto"
                  >
                    <motion.div
                      className={cn(
                        "border border-border/40 bg-white overflow-hidden shadow-sm mx-auto my-4",
                        viewMode === "mobile" ? "rounded-[1.5rem]" : "rounded-lg",
                      )}
                      variants={deviceFrameVariants}
                      animate={viewMode}
                      style={{
                        width: previewDimensions.width,
                        height: viewMode === "desktop" ? "auto" : previewDimensions.height,
                        minHeight: viewMode === "desktop" ? "400px" : previewDimensions.height,
                        maxHeight: viewMode === "desktop" ? "none" : "100%",
                      }}
                    >
                      {/* Device Frame Elements */}
                      {viewMode === "mobile" && (
                        <div className="h-6 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-t-[1.5rem] border-b border-gray-200 dark:border-gray-700">
                          <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                        </div>
                      )}

                      <iframe
                        srcDoc={template}
                        className="w-full h-full border-0"
                        title="Email Template Preview"
                        sandbox="allow-same-origin"
                        style={{
                          minHeight: viewMode === "desktop" ? "400px" : "auto",
                          height: viewMode === "desktop" ? "600px" : "100%",
                        }}
                      />

                      {viewMode === "mobile" && (
                        <div className="h-10 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-b-[1.5rem] border-t border-gray-200 dark:border-gray-700">
                          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="code"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={tabContentVariants}
                    className="h-full"
                  >
                    <div className="h-full border border-border/40 rounded-lg bg-muted/30 overflow-hidden">
                      <ScrollArea className="h-full">
                        <pre className="p-4 text-xs">
                          <code className="text-foreground break-all whitespace-pre-wrap font-mono">{template}</code>
                        </pre>
                      </ScrollArea>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border/40 space-y-2 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="h-8 text-xs"
                  disabled={isCopied}
                >
                  {isCopied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy HTML
                    </>
                  )}
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={navigateToSendPage}>
                  <Send className="h-3 w-3 mr-2" />
                  Send Email
                </Button>
              </div>
            </div>
          </Tabs>
        </>
      )}

      {/* Resize indicator */}
      {isResizing && (
        <div className="absolute top-4 left-4 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-mono z-20">
          {panelWidth}px
        </div>
      )}
    </div>
  )
}
