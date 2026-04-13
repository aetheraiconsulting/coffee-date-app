import { createClient } from "@/lib/supabase/server"
import { redirect } from 'next/navigation'
import DemoChat from "@/components/demo-chat"

export default async function DemoChatPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ androidId: string }>
  searchParams: Promise<{ present?: string }>
}) {
  const { androidId } = await params
  const { present } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: android, error } = await supabase
    .from("androids")
    .select("*")
    .eq("id", androidId)
    .eq("user_id", user.id)
    .single()

  if (error || !android) {
    redirect("/dashboard")
  }

  return <DemoChat android={android} userId={user.id} autoPresent={present === "true"} />
}
