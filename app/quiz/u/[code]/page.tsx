import QuizFunnelForm from "@/components/quiz-funnel-form"

interface PageProps {
  params: Promise<{ code: string }>
}

export default async function QuizByCodePage({ params }: PageProps) {
  const { code } = await params
  return <QuizFunnelForm code={code} />
}
