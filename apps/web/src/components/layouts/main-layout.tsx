import { BlankLayout } from '@/components/layouts'
import { Nav } from '@/components/nav/nav'
import { AiAssistantPanel } from '@/features/ai-assistant/components/ai-assistant-panel'
import { ReactNode } from 'react'

export interface MainLayoutProps {
  children?: ReactNode
  bordered?: boolean
  hideAiPanel?: boolean
}

/**
 * Main layout component with navbar
 * Wraps all main pages with BlankLayout and Nav
 *
 * @example
 * export const HomePage = () => {
 *   return (
 *     <MainLayout>
 *       <Hero />
 *     </MainLayout>
 *   );
 * };
 */
export const MainLayout = ({
  children,
  bordered = true,
  hideAiPanel = false,
}: MainLayoutProps) => {
  return (
    <BlankLayout bordered={bordered}>
      <Nav />
      {children}
      {!hideAiPanel && <AiAssistantPanel />}
    </BlankLayout>
  )
}
