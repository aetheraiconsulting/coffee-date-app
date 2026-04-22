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
  MessageCircle,
  Briefcase,
  Bot,
  LifeBuoy,
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
      { icon: MessageCircle, label: "Replies", href: "/replies" },
      { icon: Phone, label: "Call Prep", href: "/call-prep" },
      { icon: FileText, label: "Proposals", href: "/proposal", exact: true },
      { icon: Coffee, label: "Coffee Date Demo", href: "/demo" },
      { icon: Wand2, label: "Build Android", href: "/prompt-generator", indent: true },
      { icon: Bot, label: "Agent Library", href: "/agents" },
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
    label: "Delivery",
    items: [
      { icon: Briefcase, label: "Clients", href: "/clients" },
    ],
  },
  {
    label: "Resources",
    items: [{ icon: Library, label: "Prompt Library", href: "/library" }],
  },
  // Phase 4H — surface the new Aether Team support surface as its own
  // section rather than nesting it inside Delivery, so operators
  // understand this is a human-assisted channel that lives alongside the
  // rest of the app.
  {
    label: "Aether Team",
    items: [
      { icon: LifeBuoy, label: "Support Requests", href: "/support-requests" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: Settings2, label: "Settings", href: "/settings" },
      { icon: Palette, label: "Branding", href: "/settings/branding", indent: true },
    ],
  },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)

  // Track the `lg` breakpoint so we can ignore the persisted collapsed state
  // on mobile — the drawer always renders fully expanded there.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Effective collapsed state: only honour the toggle on desktop. On mobile
  // we always render the expanded drawer so tap targets and labels are
  // readable inside the slide-over.
  const effectiveCollapsed = isDesktop && isCollapsed

  // Mobile drawer autoclose: when a link is tapped below `lg` we want to
  // dismiss the slide-over so the user lands on the target page with the
  // background content visible. The parent shell passes `onNavigate` which
  // toggles the drawer closed.
  const handleLinkClick = () => {
    if (!isDesktop) {
      onNavigate?.()
    }
  }

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
        // `h-full` + the fixed/static positioning from the parent shell lets
        // this component behave as a slide-over on mobile without needing its
        // own `sticky` offset. On desktop the outer wrapper is `static` so the
        // sidebar still occupies layout space as before.
        "border-r border-white/10 bg-black h-full flex flex-col relative overflow-visible transition-all duration-200",
        // Force the mobile drawer to be exactly 16rem wide so the slide
        // transform is consistent; let desktop use the collapse toggle.
        "w-64",
        isCollapsed ? "lg:w-16" : "lg:w-64",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapse}
        className={cn(
          // Collapse toggle is desktop-only — on mobile the drawer is either
          // fully open or fully hidden so there's no useful mid-state.
          "hidden lg:flex absolute -right-4 top-[36.5px] h-8 w-8 rounded-full bg-black border-2 border-white/20 text-white shadow-lg z-[100] transition-all duration-200",
          "hover:!bg-[#00A8FF] hover:!border-[#00A8FF] dark:hover:!bg-[#00A8FF] dark:hover:!border-[#00A8FF]",
          "dark:border-white/20 dark:text-white",
        )}
        title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", effectiveCollapsed && "rotate-180")} />
      </Button>

      <div className="border-b border-white/10 flex items-center h-[73px] px-4 justify-start">
        {effectiveCollapsed ? (
          <Image src="/images/aether-revive-logo.png" alt="Aether Revive" width={32} height={32} className="flex-shrink-0" />
        ) : (
          <Image src="/images/aether-revive-logo.png" alt="Aether Revive" width={180} height={50} className="object-contain" />
        )}
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {menuSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {!effectiveCollapsed && (
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
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg transition-all text-sm font-medium min-h-[44px]",
                    effectiveCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                    isIndented && !effectiveCollapsed && "ml-4 py-2",
                    isActive
                      ? "bg-[#00A8FF] text-white shadow-lg shadow-[#00A8FF]/20"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                  title={effectiveCollapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isIndented && "h-4 w-4", isActive && "text-white")} />
                  {!effectiveCollapsed && item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
