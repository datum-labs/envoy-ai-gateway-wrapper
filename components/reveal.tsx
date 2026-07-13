import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: ReactNode
  /** Stagger index — each step adds a small delay. */
  index?: number
  /** Base delay in ms, added on top of the index stagger. */
  delay?: number
  /** Use a plain fade (no upward translate). */
  fade?: boolean
  className?: string
  style?: CSSProperties
}

const STEP_MS = 35

export function Reveal({ children, index = 0, delay = 0, fade = false, className, style }: RevealProps) {
  return (
    <div
      className={cn(fade ? 'reveal-fade' : 'reveal', className)}
      style={{ animationDelay: `${delay + index * STEP_MS}ms`, ...style }}
    >
      {children}
    </div>
  )
}
