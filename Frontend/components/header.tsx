"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModeToggle } from "@/components/mode-toggle"
import { useSidebar } from "@/components/sidebar-provider"
import { Search, Menu, Github } from "lucide-react"

export default function Header() {
  const pathname = usePathname()
  const { toggle } = useSidebar()
  const [title, setTitle] = useState("Dashboard")

  useEffect(() => {
    // Set page title based on pathname
    switch (pathname) {
      case "/":
        setTitle("Dashboard")
        break
      case "/logs":
        setTitle("Log Browser")
        break
      case "/templates":
        setTitle("Template Analysis")
        break
      case "/files":
        setTitle("File Management")
        break
      case "/analytics":
        setTitle("Analytics")
        break
      default:
        setTitle("Log Analyzer")
    }
  }, [pathname])

  return (
    <header className="sticky top-0 z-10 flex items-center h-16 gap-4 px-4 border-b bg-background md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={toggle}>
        <Menu className="w-5 h-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="hidden md:flex md:flex-1 md:items-center md:gap-4 md:justify-end">
        {/*  */}
      </div>
      <ModeToggle />
      <a
        href="https://github.com/ChetanGiri1997"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub Profile"
        className="inline-flex items-center justify-center w-10 h-10 p-0 text-sm font-medium transition-colors bg-transparent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none hover:bg-accent hover:text-accent-foreground"
      >
        <Github className="w-5 h-5" />
        <span className="sr-only">GitHub Profile by Chetan Giri</span>
      </a>
    </header>
  )
}