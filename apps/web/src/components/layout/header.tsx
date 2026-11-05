"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n";
import { useOpsStats } from "@/hooks/use-ops";
import { buildNotices } from "@/lib/notifications";

export function Header() {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { stats } = useOpsStats(30_000);
  const notices = buildNotices(stats);

  const submit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/leads?q=${encodeURIComponent(q)}` : "/leads");
  };

  return (
    <header className="h-14 border-b flex items-center gap-3 px-4 sm:px-6 bg-background/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-30">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("common.openMenu")}>
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <form className="flex-1 max-w-sm" onSubmit={submit} role="search">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("header.searchLabel")}
            placeholder={t("header.search")}
            className="pl-8 h-9 bg-muted/50 border-0 text-sm"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={t("header.notifications")}>
              <Bell className="h-4 w-4" />
              {notices.length > 0 && <span data-testid="notif-dot" className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-glow-pulse" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{t("header.notifications")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notices.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">{t("header.noNotifications")}</p>}
            {notices.map((n) => (
              <DropdownMenuItem key={n.id} asChild className="flex flex-col items-start gap-0.5 py-2">
                <Link href={n.href}>
                  <span className="text-sm font-medium">{t(n.title, { n: n.n ?? 0 })}</span>
                  <span className="text-xs text-muted-foreground">{t(n.hint)}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
