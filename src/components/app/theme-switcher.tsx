"use client";

import { cn } from "cn";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useIsHydrated } from "@/hooks/use-is-hydrated";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Light / dark / follow-the-phone, as a three-way segmented control. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; showing a selection before
  // hydration would produce markup the server could not have matched.
  const hydrated = useIsHydrated();

  return (
    <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1" role="group" aria-label="Theme">
      {OPTIONS.map((option) => {
        const active = hydrated && theme === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "tap-transparent flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
