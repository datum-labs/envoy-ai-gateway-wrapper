'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@datum-cloud/datum-ui/theme'
import { Monitor, Moon, Sun } from 'lucide-react'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-card p-0.5"
      role="radiogroup"
      aria-label="Color theme"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={`flex size-7 items-center justify-center rounded-full transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
