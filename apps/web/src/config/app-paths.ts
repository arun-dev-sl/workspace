export const appPaths = {
  home: {
    getHref: () => '/',
  },
  auth: {
    register: {
      getHref: (redirectTo?: string | null) =>
        `/register${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
    },
    login: {
      getHref: (redirectTo?: string | null) =>
        `/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
    },
    // Dashboard path
    dashboard: {
      getHref: () => '/dashboard',
    },
    // Themes path
    themes: {
      getHref: () => '/themes',
    },
    analytics: {
      getHref: () => '/analytics',
    },
    patterns: {
      getHref: () => '/patterns',
    },
    holdings: {
      getHref: () => '/holdings',
    },
    dividends: {
      getHref: () => '/dividends',
    },
    playground: {
      getHref: () => '/playground',
    },
    expensesEmails: {
      getHref: () => '/expenses/emails',
    },
    expensesEmailDetails: {
      getHref: (id: string) => `/expenses/emails/${encodeURIComponent(id)}`,
    },
  },
} as const
