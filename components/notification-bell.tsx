"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"

// Shape mirrors the live `notifications` table: body/action_href/read (bool),
// not message/link/read_at. `related_id` is an optional uuid that ties the
// notification to a domain entity (proposal_id, audit_id, etc.).
interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  action_href: string | null
  related_id: string | null
  read: boolean
  created_at: string
}

interface NotificationPayload {
  notifications: NotificationItem[]
  unreadCount: number
}

const fetcher = async (url: string): Promise<NotificationPayload> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load notifications")
  return res.json()
}

// Tiny relative-time helper so we avoid pulling a date lib in for a single use.
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)

  // Poll every 30s while the page is focused. SWR handles focus-revalidation
  // automatically so opening a tab surfaces new notifications quickly without
  // needing a websocket subscription.
  const { data, mutate } = useSWR<NotificationPayload>("/api/notifications", fetcher, {
    refreshInterval: 30_000,
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  const handleItemClick = async (n: NotificationItem) => {
    if (!n.read) {
      // Optimistically strike through the unread badge so the UI feels snappy;
      // SWR will reconcile with the real count on next revalidation.
      mutate(
        (prev) =>
          prev
            ? {
                notifications: prev.notifications.map((x) =>
                  x.id === n.id ? { ...x, read: true } : x,
                ),
                unreadCount: Math.max(0, prev.unreadCount - 1),
              }
            : prev,
        false,
      )

      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      })
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    mutate(
      (prev) =>
        prev
          ? {
              notifications: prev.notifications.map((x) => ({ ...x, read: true })),
              unreadCount: 0,
            }
          : prev,
      false,
    )
    await fetch("/api/notifications/mark-read", { method: "POST" })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#00AAFF] text-white text-[10px] font-bold flex items-center justify-center"
              aria-hidden
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[360px] p-0 bg-[#0B0F14] border-white/10 text-white"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-white/60 hover:text-white"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/50">You&apos;re all caught up.</p>
              <p className="text-xs text-white/30 mt-1">
                Prospects, replies, and wins will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((n) => {
                const inner = (
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
                        n.read ? "bg-white/20" : "bg-[#00AAFF]",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          n.read ? "text-white/70" : "text-white",
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[11px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )

                return (
                  <li key={n.id}>
                    {n.action_href ? (
                      <Link href={n.action_href} onClick={() => handleItemClick(n)} className="block">
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className="block w-full text-left"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
