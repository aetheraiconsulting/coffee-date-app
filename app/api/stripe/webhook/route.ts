import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import type Stripe from "stripe"

// Use service role client for webhook (no user session)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (!userId) break
      await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          stripe_subscription_id: session.subscription as string,
        })
        .eq("id", userId)
      break
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (!userId) break

      const status =
        subscription.status === "active" ? "active"
        : subscription.status === "trialing" ? "trial"
        : subscription.status === "past_due" ? "limited"
        : subscription.status === "paused" ? "limited"
        : subscription.status === "canceled" ? "cancelled"
        : "limited"

      await supabase
        .from("profiles")
        .update({
          subscription_status: status,
          subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq("id", userId)
      break
    }

    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (!userId) break
      // Trial ending in 3 days — the dashboard banner handles display
      await supabase
        .from("profiles")
        .update({ subscription_status: "trial" })
        .eq("id", userId)
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (!userId) break

      await supabase
        .from("profiles")
        .update({
          subscription_status: "limited",
          flagged_for_team: true,
          flagged_at: new Date().toISOString(),
        })
        .eq("id", userId)

      await sendLapsedUserAlert(userId)
      break
    }

    case "customer.subscription.resumed": {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (!userId) break
      await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          flagged_for_team: false,
        })
        .eq("id", userId)
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("stripe_customer_id", customerId)
        .maybeSingle()

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            subscription_status: "limited",
            flagged_for_team: true,
            flagged_at: new Date().toISOString(),
          })
          .eq("id", profile.id)

        await sendLapsedUserAlert(profile.id)
      }
      break
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle()

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
            flagged_for_team: false,
          })
          .eq("id", profile.id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function sendLapsedUserAlert(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, subscription_status, created_at, promo_code_used")
    .eq("id", userId)
    .maybeSingle()

  if (!profile || !process.env.ALERT_EMAIL || !process.env.RESEND_API_KEY) return

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "alerts@aetherrevive.com",
      to: process.env.ALERT_EMAIL,
      subject: `Aether Revive — Lapsed user: ${profile.full_name || profile.email}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a2e;">User access lapsed</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666;">Name</td><td style="padding: 8px 0; font-weight: 600;">${profile.full_name || "Unknown"}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0; font-weight: 600;">${profile.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Status</td><td style="padding: 8px 0; font-weight: 600; color: #e24b4a;">${profile.subscription_status}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Member since</td><td style="padding: 8px 0;">${new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Promo code</td><td style="padding: 8px 0;">${profile.promo_code_used || "None"}</td></tr>
          </table>
          <p style="color: #666; margin-top: 24px;">This user has been moved to limited access. Follow up to re-engage.</p>
          <a href="mailto:${profile.email}" style="display: inline-block; background: #00AAFF; color: #000; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Email this user →
          </a>
        </div>
      `
    })
  }).catch(() => {})
}
