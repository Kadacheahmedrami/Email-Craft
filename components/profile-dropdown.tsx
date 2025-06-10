"use client"

import React, { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { LogOut, User, ChevronDown, Settings } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

export default function ProfileDropdown() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden">
          {session.user?.image ? (
            <Image 
              src={session.user.image || "/placeholder.svg"} 
              alt="Profile" 
              width={32} 
              height={32} 
              className="rounded-full" 
            />
          ) : (
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-foreground hidden sm:block">
          {session.user?.name || session.user?.email?.split('@')[0]}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-56 bg-background border border-border rounded-lg shadow-lg py-1 z-50"
          >
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground">
                {session.user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.user?.email}
              </p>
            </div>

            <Link 
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Link>

            <Link 
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>

            <div className="h-px bg-border my-1" />

            <button
              onClick={() => { signOut(); setIsOpen(false) }}
              className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-muted/50 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
