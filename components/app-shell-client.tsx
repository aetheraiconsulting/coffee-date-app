"use client"

/**
 * App shell client wrapper.
 *
 * Owns mobile-specific chrome that the server layout cannot:
 *   - Mobile sidebar open/close state (slide-over drawer below `lg`)
 *   - Semi-transparent backdrop + body scroll lock while the drawer is open
 *   - Dismissable desktop-recommendation banner (visible only below `lg`)
 *
 * Above `lg` (1024px) this component is effectively invisible — the sidebar
 * renders inline exactly as it did before this refactor, so desktop behaviour
 * is completely preserved.
 */

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"

const BANNER_KEY = "desktop-banner-dismissed"

export function AppShellClient({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(true) // start true to avoid flash

  // Hydrate banner state from localStorage after mount.
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(BANNER_KEY)
      setBannerDismissed(dismissed === "true")
    } catch {
      setBannerDismissed(false)
    }
  }, [])

  // Lock body scroll when mobile drawer is open so background doesn't scroll
  // behind the overlay.
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [mobileOpen])

  // Close the drawer if the viewport grows past the lg breakpoint (user
  // rotated tablet, resized browser, etc.) — otherwise the open state stays
  // stuck "true" even though the drawer is no longer visible.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const open = useCallback(() => setMobileOpen(true), [])
  const close = useCallback(() => setMobileOpen(false), [])

  const handleDismissBanner = () => {
    try {
      localStorage.setItem(BANNER_KEY, "true")
    } catch {
      // swallow
    }
    setBannerDismissed(true)
  }

  return (
    <div className="flex h-screen bg-black">
      {/* Mobile backdrop — only rendered below `lg` and only when open. */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar:
          - Desktop (lg+): static flex item, original behaviour untouched.
          - Mobile: fixed slide-over, translated off-screen unless `mobileOpen`. */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <AppSidebar onNavigate={close} />
        {/* Mobile close button overlayed on the sidebar */}
        <button
          type="button"
          onClick={close}
          aria-label="Close navigation"
          className="absolute top-5 right-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Desktop recommendation banner (authenticated pages only) */}
        {!bannerDismissed && (
          <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 lg:hidden">
            <p className="flex-1 text-xs leading-relaxed text-amber-300">
              Aether Revive works best on desktop. Some features may be limited on mobile.
            </p>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Dismiss desktop recommendation"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <AppHeader onMenuClick={open} />

        <main className="flex-1 overflow-auto bg-black">{children}</main>
      </div>
    </div>
  )
}

/** Standalone hamburger trigger, re-exported so the header can render it. */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open navigation"
      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}
