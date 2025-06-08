import type { Metadata } from "next"
import { LandingPageClient } from "@/components/landing-page-client"

// Complete SEO metadata for landing page
export const metadata: Metadata = {
  metadataBase: new URL("https://emailcraft.ai"),
  title: "EmailCraft - AI Email Template Generator | Create Gmail Templates Instantly",
  description:
    "Create stunning, responsive email templates with AI in minutes. Design professional Gmail templates, newsletters, and automated email designs. Free AI-powered email template builder.",
  applicationName: "EmailCraft",
  referrer: "origin-when-cross-origin",
  keywords: [
    "email templates",
    "gmail templates with ai",
    "automating gmail templates",
    "easy email templates",
    "creating email templates",
    "AI email generator",
    "email template builder",
    "automated email templates",
    "responsive email design",
    "newsletter templates",
    "email marketing templates",
    "professional email templates",
    "email automation",
    "gmail template creator",
    "email design tool",
    "AI email designer",
    "email template generator",
    "custom email templates",
    "transactional email templates",
    "email campaign builder",
  ],
  authors: [{ name: "EmailCraft Team", url: "https://emailcraft.ai" }],
  creator: "EmailCraft",
  publisher: "EmailCraft",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://emailcraft.ai",
    title: "EmailCraft - AI Email Template Generator",
    description:
      "Create stunning, responsive email templates with AI in minutes. Professional designs for Gmail, newsletters, and marketing campaigns.",
    siteName: "EmailCraft",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EmailCraft - AI Email Template Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EmailCraft - AI Email Template Generator",
    description: "Create stunning, responsive email templates with AI in minutes.",
    images: ["/og-image.png"],
    creator: "@emailcraft",
  },
  verification: {
    google: "your-google-verification-code",
  },
  alternates: {
    canonical: "https://emailcraft.ai",
  },
  category: "Technology",
}

// Server-side static data
const landingPageData = {
  stats: [
    { number: "10K+", label: "Templates Created", icon: "📧" },
    { number: "99%", label: "Email Compatibility", icon: "✅" },
    { number: "5min", label: "Average Creation Time", icon: "⚡" },
  ],
  features: {
    title: "Create Stunning Email Templates",
    subtitle:
      "Design professional, responsive email templates with AI assistance. From newsletters to transactional emails, create beautiful designs in minutes, not hours.",
  },
}

// Add JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "EmailCraft",
  description: "AI-powered email template generator for creating professional, responsive email designs",
  url: "https://emailcraft.ai",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "1250",
  },
  author: {
    "@type": "Organization",
    name: "EmailCraft Team",
  },
}

// Pure server component - no authentication needed
export default function HomePage() {
  return (
    <>
      {/* JSON-LD structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Client component with server data */}
      <LandingPageClient data={landingPageData} />
    </>
  )
}
