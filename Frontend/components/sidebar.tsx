"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/sidebar-provider"
import { LayoutDashboard, FileText, FileCode, Database, BarChart3, ChevronLeft, ChevronRight } from "lucide-react"

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Logs",
    href: "/logs",
    icon: FileText,
  },
  {
    title: "Templates",
    href: "/templates",
    icon: FileCode,
  },
  {
    title: "Files",
    href: "/files",
    icon: Database,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isOpen, toggle } = useSidebar()

  return (
    <div
      className={cn("relative h-screen border-r bg-background transition-all duration-300", isOpen ? "w-64" : "w-16")}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <div className={cn("flex items-center", !isOpen && "justify-center w-full")}>
          {isOpen && <span className="text-xl font-bold">Log Analyzer</span>}
          {!isOpen && <span className="text-xl font-bold">LA</span>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn("h-8 w-8", !isOpen && "absolute -right-4 top-7 z-10 bg-background border rounded-full")}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="flex flex-col h-full">
          <div className="py-4">
            <nav className="px-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className={cn("h-5 w-5", !isOpen && "mx-auto")} />
                  {isOpen && <span className="ml-3">{item.title}</span>}
                </Link>
              ))}
            </nav>
          </div>
          <div className="px-4 py-3 mt-auto text-xs text-muted-foreground">
            {isOpen ? (
              <>
                <p>&copy; 2025 Chetan Giri. All rights reserved.</p>
                <p className="mt-1">Note: Log Analyzer is still in development phase.</p>
              </>
            ) : (
              <p className="text-center">&copy;</p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}