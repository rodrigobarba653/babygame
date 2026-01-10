import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gender Reveal Party Game',
  description: 'A fun multiplayer party game for gender reveal celebrations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

