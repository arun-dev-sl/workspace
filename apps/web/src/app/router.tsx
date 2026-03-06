import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "./layouts/root-layout";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/auth/login";
import { RegisterPage } from "@/pages/auth/register";
import { NotFoundPage } from "@/pages/not-found";
import { ProtectedRoute } from "@/components/protected-routes/protected-route";
import Dashboard from "@/pages/dashboard";
import ThemeSettingsPage from "@/pages/theme";
import ExpenseEmailsPage from "@/pages/expenses/emails";
import ExpenseEmailDetailsPage from "@/pages/expenses/email-details";
import AnalyticsPage from "@/pages/expenses/analytics";
import PatternsPage from "@/pages/expenses/patterns";
import HoldingsPage from "@/pages/holdings";
import DividendsPage from "@/pages/dividends";
import PlaygroundPage from "@/pages/playground";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // Public Routes
      {
        index: true,
        element: (
          <ProtectedRoute isPublic>
            <HomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "login",
        element: (
          <ProtectedRoute isPublic>
            <LoginPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "register",
        element: (
          <ProtectedRoute isPublic>
            <RegisterPage />
          </ProtectedRoute>
        ),
      },
      // Protected Routes
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "themes",
        element: (
          <ProtectedRoute>
            <ThemeSettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "analytics",
        element: (
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "patterns",
        element: (
          <ProtectedRoute>
            <PatternsPage />
          </ProtectedRoute>
        ),
      },

      {
        path: "holdings",
        element: (
          <ProtectedRoute>
            <HoldingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "dividends",
        element: (
          <ProtectedRoute>
            <DividendsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "playground",
        element: (
          <ProtectedRoute>
            <PlaygroundPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "expenses/emails",
        element: (
          <ProtectedRoute>
            <ExpenseEmailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "expenses/emails/:id",
        element: (
          <ProtectedRoute>
            <ExpenseEmailDetailsPage />
          </ProtectedRoute>
        ),
      },
      // Fallback Route
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

export const AppRouter = () => <RouterProvider router={router} />;
