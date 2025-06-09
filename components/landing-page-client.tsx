"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Mail, Sparkles, Github, Twitter, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { motion } from "framer-motion"

interface LandingPageData {
  stats: Array<{
    number: string
    label: string
    icon: string
  }>
  features: {
    title: string
    subtitle: string
  }
}

interface LandingPageClientProps {
  data: LandingPageData
}

export function LandingPageClient({ data }: LandingPageClientProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  const Start = () => {
    router.push(`/chat`)
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
  }

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      rotate: [-2, 2, -2],
      transition: {
        duration: 6,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      },
    },
  }

  const pulseVariants = {
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 3,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      },
    },
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        {/* Enhanced Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Dynamic Gradient Orbs */}
          <motion.div
            className="absolute w-96 h-96 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-full blur-3xl"
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            style={{
              left: mousePosition.x * 0.02 + "px",
              top: mousePosition.y * 0.02 + "px",
            }}
          />
          <motion.div
            className="absolute w-80 h-80 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full blur-3xl"
            animate={{
              x: [0, -80, 0],
              y: [0, 60, 0],
              scale: [1, 0.8, 1],
            }}
            transition={{
              duration: 15,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: 2,
            }}
            style={{
              right: typeof window !== "undefined" ? (window.innerWidth - mousePosition.x) * 0.015 + "px" : "0px",
              bottom: typeof window !== "undefined" ? (window.innerHeight - mousePosition.y) * 0.015 + "px" : "0px",
            }}
          />

          {/* Floating Elements */}
          <motion.div
            className="absolute top-20 left-20 w-4 h-4 bg-primary/40 rounded-full"
            variants={floatingVariants}
            animate="animate"
          />
          <motion.div
            className="absolute top-40 right-32 w-6 h-6 bg-purple-500/40 rounded-full"
            variants={floatingVariants}
            animate="animate"
            transition={{ delay: 1 }}
          />
          <motion.div
            className="absolute bottom-32 left-32 w-3 h-3 bg-blue-500/40 rounded-full"
            variants={floatingVariants}
            animate="animate"
            transition={{ delay: 2 }}
          />

          {/* Enhanced Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        </div>

        {/* Navigation */}
        <motion.nav
          className="relative z-10 flex items-center justify-between p-6 lg:px-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg"
              variants={pulseVariants}
              animate="animate"
            >
              <Mail className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">EmailCraft</h1>
              <p className="text-xs text-muted-foreground">AI Email Designer</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="https://github.com" target="_blank">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Link>
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={Start}>
              Get Started
            </Button>
          </div>
        </motion.nav>

        {/* Full Height Hero Section */}
        <main className="relative md:h-[90.1svh] z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-6 text-center">
          <motion.div className="max-w-6xl mx-auto" variants={containerVariants} initial="hidden" animate="visible">
            {/* Badge */}
            <motion.div className="mb-8" variants={itemVariants}>
              <Badge
                variant="secondary"
                className="px-6 py-3 text-sm font-medium bg-primary/10 text-primary border-primary/20 shadow-lg backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Powered by Advanced AI
              </Badge>
            </motion.div>

            {/* Main Heading */}
            <motion.div className="mb-12 space-y-6" variants={itemVariants}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  Create Stunning
                </span>
                <br />
                <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
                  Email Templates
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                {data.features.subtitle}
              </p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div className="mb-16 flex flex-col sm:flex-row gap-6 justify-center" variants={itemVariants}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  onClick={Start}
                  className="h-14 px-10 text-lg font-medium shadow-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                >
                  Start Creating
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 px-10 text-lg border-2 hover:shadow-lg backdrop-blur-sm"
                  asChild
                >
                  <Link href="#features">Learn More</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Enhanced Stats */}
            <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-16" variants={containerVariants}>
              {data.stats.map((stat, index) => (
                <motion.div
                  key={index}
                  className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                >
                  <div className="text-4xl mb-2">{stat.icon}</div>
                  <div className="text-4xl font-bold text-primary mb-2">{stat.number}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <ChevronDown className="h-6 w-6 text-muted-foreground" />
            </motion.div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur">
          <div className="flex flex-col sm:flex-row items-center justify-between p-6 lg:px-8">
            <div className="flex items-center gap-2 mb-4 sm:mb-0">
              <div className="w-6 h-6 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Mail className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">© 2024 EmailCraft. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="https://twitter.com" target="_blank">
                  <Twitter className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="https://github.com" target="_blank">
                  <Github className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  )
}
