"use client"

import { Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Locale-aware light/dark/system theme toggle. Renders a single icon button
 * (sun in light mode, moon in dark) that opens a menu of the three next-themes
 * modes. Selecting an option calls `setTheme`, which next-themes persists to
 * `localStorage`, so the choice survives a refresh. All labels come from the
 * `ThemeToggle` message namespace so the control reads correctly in English and
 * Hebrew (RTL); the trigger carries an accessible name via the visually hidden
 * label since its visible content is icon-only.
 */
export function ModeToggle() {
  const { setTheme } = useTheme()
  const t = useTranslations("ThemeToggle")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon">
            <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">{t("label")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {t("light")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {t("dark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          {t("system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
