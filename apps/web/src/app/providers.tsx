import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { AuthSessionProvider } from '@/app/auth-session-context'

import { MainErrorFallback } from '@/components/errors/main'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { env } from '@/config/env'
import { queryConfig } from '@/lib/react-query'

interface AppProviderProperties {
  children: React.ReactNode
}

export const AppProvider = ({ children }: AppProviderProperties) => {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: queryConfig,
      }),
  )

  return (
    <ErrorBoundary FallbackComponent={MainErrorFallback}>
      <ThemeProvider defaultTheme="system">
        <QueryClientProvider client={queryClient}>
          <AuthSessionProvider>
            {env.NODE_ENV === 'development' && (
              <ReactQueryDevtools buttonPosition="bottom-left" />
            )}
            <Toaster position="bottom-right" richColors closeButton />
            {children}
          </AuthSessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
