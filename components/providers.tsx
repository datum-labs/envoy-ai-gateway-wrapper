'use client'

import type { ReactNode } from 'react'
import { ThemeProvider, ThemeScript } from '@datum-cloud/datum-ui/theme'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="envoy-gateway-theme"
      disableTransitionOnChange
    >
      <ThemeScript />
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  )
}
