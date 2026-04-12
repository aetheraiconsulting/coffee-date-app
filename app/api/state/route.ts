import { NextResponse } from "next/server"
import { getUserState } from "@/lib/getUserState"

export async function GET() {
  try {
    const state = await getUserState()

    if (!state) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    return NextResponse.json({ state })
  } catch (error) {
    console.error("Error fetching user state:", error)
    return NextResponse.json(
      { error: "Failed to fetch state" },
      { status: 500 }
    )
  }
}
