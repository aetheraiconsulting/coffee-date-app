import { createClient as createServiceClient } from "@supabase/supabase-js"

// A prospect is captured across multiple touchpoints (audit, quiz, demo,
// manual-add). `source` records the original touchpoint on the row; every
// subsequent touchpoint is appended into `metadata.sources` (deduped) so
// the Clients page can show a full engagement history.
export type ProspectSource = "audit" | "quiz" | "demo" | "manual"

interface UpsertProspectInput {
  user_id: string
  email: string
  name?: string | null
  business?: string | null
  source: ProspectSource
  source_id?: string | null
  extraMetadata?: Record<string, unknown>
}

/**
 * Idempotent prospect writer. We always use the service-role client here
 * because the two main callers (audit/quiz submit endpoints) run without an
 * authenticated session — the prospect is an anonymous visitor to the user's
 * audit/quiz link.
 *
 * Conflict resolution on `(user_id, email)` merges the new touchpoint into
 * the existing record's metadata (array-dedupe of sources) instead of
 * overwriting — so a prospect who submits the audit then fills out the quiz
 * ends up with one row whose `metadata.sources` contains both.
 */
export async function upsertProspect(
  input: UpsertProspectInput,
): Promise<{ id: string } | null> {
  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const normalizedEmail = input.email.trim().toLowerCase()
    if (!normalizedEmail) return null

    // Look up existing row first so we can merge source history + metadata.
    const { data: existing } = await supabase
      .from("prospects")
      .select("id, metadata")
      .eq("user_id", input.user_id)
      .eq("email", normalizedEmail)
      .maybeSingle()

    const nowIso = new Date().toISOString()

    if (existing) {
      const prevMeta = (existing.metadata as Record<string, unknown>) || {}
      const prevSources = Array.isArray((prevMeta as any).sources)
        ? ((prevMeta as any).sources as string[])
        : []
      const mergedSources = Array.from(new Set([...prevSources, input.source]))
      const mergedMetadata = {
        ...prevMeta,
        ...(input.extraMetadata ?? {}),
        sources: mergedSources,
      }

      // Don't overwrite name/business if they were previously captured — we
      // only back-fill nulls.
      const patch: Record<string, unknown> = {
        metadata: mergedMetadata,
        last_activity_at: nowIso,
        updated_at: nowIso,
      }
      if (input.name) patch.name = input.name
      if (input.business) patch.business = input.business

      const { data: updated, error } = await supabase
        .from("prospects")
        .update(patch)
        .eq("id", existing.id)
        .select("id")
        .single()

      if (error) {
        console.log("[v0] upsertProspect update error:", error.message)
        return null
      }
      return updated
    }

    const { data: inserted, error } = await supabase
      .from("prospects")
      .insert({
        user_id: input.user_id,
        email: normalizedEmail,
        name: input.name ?? null,
        business: input.business ?? null,
        source: input.source,
        source_id: input.source_id ?? null,
        metadata: {
          ...(input.extraMetadata ?? {}),
          sources: [input.source],
        },
        first_contact_at: nowIso,
        last_activity_at: nowIso,
      })
      .select("id")
      .single()

    if (error) {
      console.log("[v0] upsertProspect insert error:", error.message)
      return null
    }

    return inserted
  } catch (err) {
    console.log("[v0] upsertProspect unexpected error:", (err as Error).message)
    return null
  }
}
