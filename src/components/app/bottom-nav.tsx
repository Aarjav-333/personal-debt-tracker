"use client";

import { cn } from "cn";
import { Clock, Home, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/borrowers", label: "Borrowers", icon: Users },
  { href: "/activity", label: "Activity", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Fixed bottom navigation.
 *
 * Thumb-reachable on an iPhone, sits above the home indicator via `pb-safe`,
 * and puts "Add" in the middle where it is hardest to miss.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [left, right] = [ITEMS.slice(0, 2), ITEMS.slice(2)];

  return (
    <nav
      aria-label="Main"
      className="bg-background/85 border-border pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-between px-2">
        {left.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}

        <li className="flex items-center justify-center px-1">
          <Link
            href="/add"
            aria-label="Add a borrowing"
            className={cn(
              "bg-primary text-primary-foreground tap-transparent flex size-14 -translate-y-3 items-center justify-center rounded-full shadow-lg",
              "ring-background focus-visible:ring-ring ring-4 transition-transform focus-visible:ring-4 focus-visible:outline-none active:scale-95",
              isActive(pathname, "/add") && "ring-primary/30",
            )}
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </Link>
        </li>

        {right.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tap-transparent flex h-full flex-col items-center justify-center gap-1 rounded-lg text-[0.6875rem] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="size-5" />
        {label}
      </Link>
    </li>
  );
}
