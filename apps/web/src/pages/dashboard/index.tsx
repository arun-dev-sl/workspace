import { MainLayout } from "@/components/layouts";
import { Card } from "@workspace/ui/components/ui/card";
import { NeumorphicLoader } from "@workspace/ui/components/ui/neumorphic-loader";

const Dashboard = () => {
  return (
    <MainLayout>
      <div className="flex justify-center p-4 sm:p-6">
        <Card className="mt-4 sm:mt-10 w-full max-w-3xl p-6 sm:p-10">
          <div
            data-slot="badge"
            className="rounded-full p-10 border-2 flex w-full gap-4 hover:scale-[99%] transition-all duration-100"
            style={{
              borderRadius: "100%",
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1557672172-298e090bd0f1?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80s"
              className="w-75 h-75 object-cover opacity-80 transition-transform duration-700 group-hover:scale-105 rounded-md"
              alt="Hero"
            ></img>
            <NeumorphicLoader />
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
