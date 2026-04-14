export default function AuditPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#080B0F", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  )
}
