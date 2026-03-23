import { MainLayout } from '@/components/layouts'
import { DashboardChat } from '@/features/ai-assistant/components/dashboard-chat'

const Dashboard = () => {
  return (
    <MainLayout hideAiPanel>
      <div className="flex min-h-0 flex-1 -mt-12">
        <DashboardChat />
      </div>
    </MainLayout>
  )
}

export default Dashboard
