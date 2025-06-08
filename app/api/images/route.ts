import { type NextRequest, NextResponse } from "next/server"
import { readdir, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET(request: NextRequest) {
  try {
    const uploadsDir = join(process.cwd(), "public", "uploads")

    if (!existsSync(uploadsDir)) {
      return NextResponse.json({
        success: true,
        images: [],
        total: 0,
      })
    }

    const files = await readdir(uploadsDir)
    const imageFiles = files.filter((file) => {
      const ext = file.split(".").pop()?.toLowerCase()
      return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")
    })

    const images = await Promise.all(
      imageFiles.map(async (filename) => {
        const filepath = join(uploadsDir, filename)
        const stats = await stat(filepath)

        // Extract info from filename pattern: timestamp-randomstring.ext
        const nameParts = filename.split("-")
        const timestamp = nameParts[0]
        const randomPart = nameParts[1]?.split(".")[0]

        return {
          id: `img_${timestamp}_${randomPart}`,
          filename,
          url: `/uploads/${filename}`,
          size: stats.size,
          uploadedAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
        }
      }),
    )

    // Sort by upload date (newest first)
    images.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    return NextResponse.json({
      success: true,
      images,
      total: images.length,
    })
  } catch (error) {
    console.error("List images error:", error)
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 })
  }
}
