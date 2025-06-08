import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from  "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// DELETE /api/images/[id] - Delete an image
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the image and verify ownership
    const image = await prisma.image.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Delete from Supabase Storage
    if (image.storagePath) {
      const { error: deleteError } = await supabase.storage.from("email-templates").remove([image.storagePath])

      if (deleteError) {
        console.error("Supabase delete error:", deleteError)
      }
    }

    // Delete from database
    await prisma.image.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 })
  }
}

// GET /api/images/[id] - Get image details
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const image = await prisma.image.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      image,
    })
  } catch (error) {
    console.error("Get image error:", error)
    return NextResponse.json({ error: "Failed to get image" }, { status: 500 })
  }
}
