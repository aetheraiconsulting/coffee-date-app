import QuizFunnelForm from "@/components/quiz-funnel-form"

interface PageProps {
  params: Promise<{ subdomain: string }>
}

export default async function QuizBySubdomainPage({ params }: PageProps) {
  const { subdomain } = await params
  return <QuizFunnelForm subdomain={subdomain} />
}
