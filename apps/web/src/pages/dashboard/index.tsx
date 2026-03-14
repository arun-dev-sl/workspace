import { MainLayout } from '@/components/layouts'
import { DashboardChat } from '@/features/ai-assistant/components/dashboard-chat'

const Dashboard = () => {
  return (
    <MainLayout hideAiPanel>
      <DashboardChat />
    </MainLayout>
  )
}

export default Dashboard
