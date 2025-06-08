import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EmailCraft - AI Email Template Generator",
    short_name: "EmailCraft",
    description:
      "Create stunning, responsive email templates with AI in minutes. Professional Gmail templates, newsletters, and marketing campaigns.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3b82f6",
    orientation: "portrait",
    categories: ["productivity", "business", "utilities"],
 
  }
}
