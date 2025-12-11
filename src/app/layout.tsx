import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Lappy Medi - Nhập liệu khám sức khỏe',
  description: 'Ứng dụng nhập liệu bệnh nhân nhanh chóng và chính xác',
  icons: {
    icon: '/img/kay.jpg',
    apple: '/img/kay.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
