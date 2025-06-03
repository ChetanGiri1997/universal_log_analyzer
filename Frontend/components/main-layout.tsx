"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import { useSidebar } from "@/components/sidebar-provider"
import { useMobile } from "@/hooks/use-mobile"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { isOpen, close } = useSidebar()
  const isMobile = useMobile()

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) {
      close()
    }
  }, [pathname, isMobile, close])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
