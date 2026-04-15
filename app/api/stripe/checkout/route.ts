import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { plan, promo_code } = await request.json()

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      name: profile?.full_name || "",
      metadata: { supabase_user_id: user.id }
    })
    customerId = customer.id
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)
  }

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
  let isStudentCode = false

  if (promo_code && promo_code.trim()) {
    const cleanCode = promo_code.trim().toUpperCase()
    
    const { data: code, error: codeError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", cleanCode)
      .eq("is_active", true)
      .maybeSingle()

    console.log("Promo code lookup:", cleanCode, code, codeError)

    if (code) {
      if (code.discount_type === "months_free" && code.discount_value === 12) {
        isStudentCode = true
        
        const coupon = await stripe.coupons.create({
          percent_off: 100,
          duration: "repeating",
          duration_in_months: 12,
          name: "Discount code — 12 months free",
        })
        discounts = [{ coupon: coupon.id }]

        await supabase
          .from("promo_codes")
          .update({ uses_count: (code.uses_count || 0) + 1 })
          .eq("id", code.id)

        await supabase
          .from("profiles")
          .update({
            promo_code_used: cleanCode,
            subscription_tier: "discounted"
          })
          .eq("id", user.id)
      }
    }
  }

  const priceId = plan === "annual"
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        supabase_user_id: user.id,
        is_student: isStudentCode.toString()
      }
    },
    discounts: discounts.length > 0 ? discounts : undefined,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscribed=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade`,
    metadata: { supabase_user_id: user.id }
  })

  return NextResponse.json({ url: session.url })
}
