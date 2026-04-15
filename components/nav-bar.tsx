"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Library, LayoutDashboard, LogOut, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface NavBarProps {
  userEmail?: string
  userName?: string
}

export default function NavBar({ userEmail, userName }: NavBarProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <nav className="glass glass-border aether-glow-sm sticky top-4 mx-4 rounded-2xl z-50 mb-8">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center hover:opacity-80 transition-all duration-300">
          <Image
            src="/revive-by-aether.png"
            alt="RE:VIVE by Aether"
            width={480}
            height={150}
            className="h-[80px] w-auto animate-pulse-slow"
            priority
          />
        </Link>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:flex text-white hover:text-aether hover:bg-white/5 transition-all duration-300 uppercase font-semibold text-xs tracking-wide"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Mission Control
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:flex text-white hover:text-aether hover:bg-white/5 transition-all duration-300 uppercase font-semibold text-xs tracking-wide"
          >
            <Link href="/library">
              <Library className="h-4 w-4 mr-2" />
              Library
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:text-aether hover:bg-white/5 transition-all duration-300"
              >
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{userName || userEmail || "Account"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass glass-border">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-white">{userName || "User"}</p>
                <p className="text-xs text-gray-400">{userEmail}</p>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem asChild className="sm:hidden text-white hover:text-aether hover:bg-white/5">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="sm:hidden text-white hover:text-aether hover:bg-white/5">
                <Link href="/library">
                  <Library className="h-4 w-4 mr-2" />
                  Library
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden bg-white/10" />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
