import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

// Notification kinds the app emits. Kept as a string-literal union so
// callers (and the bell UI) can pattern-match without a lookup table.
export type NotificationType =
  | "prospect_audit_completed"
  | "prospect_quiz_completed"
  | "prospect_demo_viewed"
  | "outreach_reply_received"
  | "proposal_won"

// The live `notifications` schema uses `title`, `body`, `action_href`,
// `related_id` (uuid), and a boolean `read` — we adapt the caller-facing
// arg names to that shape here.
interface CreateNotificationInput {
  user_id: string
  type: NotificationType
  title: string
  body: string
  action_href?: string | null
  related_id?: string | null
}

/**
 * Inserts a notification row for a user. Uses the server-side Supabase client
 * so RLS applies and the write is attributed to the authenticated user when
 * called from within a request. When no authed session is available (e.g. the
 * prospect-facing audit/quiz routes use the service-role client), pass
 * `{ useServiceRole: true }` to bypass RLS with the service key.
 *
 * We intentionally swallow DB errors here — notifications are a nice-to-have
 * layer on top of the primary action (saving the prospect's submission), and
 * failing to create one must never break the user flow.
 */
export async function createNotification(
  input: CreateNotificationInput,
  opts: { useServiceRole?: boolean } = {},
): Promise<void> {
  try {
    const supabase = opts.useServiceRole
      ? createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
      : await createServerClient()

    const { error } = await supabase.from("notifications").insert({
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body,
      action_href: input.action_href ?? null,
      related_id: input.related_id ?? null,
      read: false,
    })

    if (error) {
      console.log("[v0] createNotification insert error:", error.message)
    }
  } catch (err) {
    console.log("[v0] createNotification unexpected error:", (err as Error).message)
  }
}
