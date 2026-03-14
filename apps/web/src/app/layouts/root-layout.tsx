import { AiAssistantProvider } from '@/features/ai-assistant/ai-assistant-context'
import { Outlet } from 'react-router-dom'

export const RootLayout = () => {
  return (
    <AiAssistantProvider>
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    </AiAssistantProvider>
  )
}
