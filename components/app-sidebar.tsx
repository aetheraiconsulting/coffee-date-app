"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Coffee,
  ClipboardList,
  MessageSquareHeart,
  FileSearch,
  Library,
  Settings2,
  Target,
  ChevronLeft,
  TrendingUp,
  Wand2,
  RefreshCcw,
  Send,
  FileText,
  Palette,
  Phone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

const menuSections = [
  {
    label: "Core",
    items: [
      { icon: LayoutDashboard, label: "Mission Control", href: "/dashboard" },
      { icon: TrendingUp, label: "Pipeline", href: "/pipeline" },
      { icon: Target, label: "Opportunities", href: "/revival/opportunities" },
      { icon: Wand2, label: "Build Offer", href: "/offer/builder?mode=new", indent: true },
      { icon: FileText, label: "My Offers", href: "/offer/my-offers", indent: true },
    ],
  },
  {
    label: "Execution",
    items: [
      { icon: Send, label: "Outreach", href: "/outreach" },
      { icon: Send, label: "My Outreach", href: "/outreach/my-outreach", indent: true },
      { icon: Phone, label: "Call Prep", href: "/call-prep" },
      { icon: Coffee, label: "Coffee Date Demo", href: "/demo" },
      { icon: Wand2, label: "Build Android", href: "/prompt-generator", indent: true },
      { icon: FileSearch, label: "AI Audit", href: "/audit" },
      { icon: ClipboardList, label: "Quiz", href: "/quiz" },
    ],
  },
  {
    label: "Lead Revival",
    items: [
      { icon: RefreshCcw, label: "GHL Connection", href: "/revival", exact: true },
    ],
  },
  {
    label: "Resources",
    items: [{ icon: Library, label: "Prompt Library", href: "/library" }],
  },
  {
    label: "Account",
    items: [
      { icon: Settings2, label: "Settings", href: "/settings" },
      { icon: Palette, label: "Branding", href: "/settings/branding", indent: true },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsCollapsed(savedState === "true")
    }
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
  }

  const isActiveLink = (href: string, exact?: boolean) => {
    if (!pathname) return false

    if (href === "/revival" && exact) {
      return pathname === "/revival" || pathname === "/revival/"
    }

    if (href === "/revival/opportunities") {
      return pathname.startsWith("/revival/opportunities")
    }

    if (exact) {
      return pathname === href || pathname === href + "/"
    }

    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside
      className={cn(
        "border-r border-white/10 bg-black h-screen sticky top-0 flex flex-col relative overflow-visible transition-all duration-200 z-50",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapse}
        className={cn(
          "absolute -right-4 top-[36.5px] h-8 w-8 rounded-full bg-black border-2 border-white/20 text-white shadow-lg z-[100] transition-all duration-200",
          "hover:!bg-[#00A8FF] hover:!border-[#00A8FF] dark:hover:!bg-[#00A8FF] dark:hover:!border-[#00A8FF]",
          "dark:border-white/20 dark:text-white",
        )}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", isCollapsed && "rotate-180")} />
      </Button>

      <div className="border-b border-white/10 flex items-center h-[73px] px-4 justify-start">
        {isCollapsed ? (
          <Image src="/images/aether-revive-logo.png" alt="Aether Revive" width={32} height={32} className="flex-shrink-0" />
        ) : (
          <Image src="/images/aether-revive-logo.png" alt="Aether Revive" width={180} height={50} className="object-contain" />
        )}
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {menuSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = isActiveLink(item.href, (item as any).exact)
              const isIndented = (item as any).indent

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg transition-all text-sm font-medium",
                    isCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                    isIndented && !isCollapsed && "ml-4 py-2",
                    isActive
                      ? "bg-[#00A8FF] text-white shadow-lg shadow-[#00A8FF]/20"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isIndented && "h-4 w-4", isActive && "text-white")} />
                  {!isCollapsed && item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
