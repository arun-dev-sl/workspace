import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";

import { ThemeEditorPanel } from "./components/theme-editor-panel";
import { MainLayout } from "@/components/layouts/main-layout";
import { PreviewSandbox } from "./components/preview-sandbox";

export default function ThemeSettingsPage() {
  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Theme Editor
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              Customize
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Customize your design system visually.
            </p>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          {/* LEFT: Controls */}
          <Card className="flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100dvh)]">
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              <CardDescription>Presets and variables</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden py-4">
              <ThemeEditorPanel />
            </CardContent>
          </Card>
          {/* RIGHT: Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                Your components using this theme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewSandbox />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
