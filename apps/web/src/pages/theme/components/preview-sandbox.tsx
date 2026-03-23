import { useState } from 'react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/ui/avatar'
import { Badge } from '@workspace/ui/components/ui/badge'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/ui/components/ui/popover'
import { Switch } from '@workspace/ui/components/ui/switch'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import { Input } from '@workspace/ui/components/ui/input'
import { Textarea } from '@workspace/ui/components/ui/textarea'
import {
  AlertTriangle,
  Bell,
  Bold,
  CheckCircle2,
  Info,
  Italic,
  Settings,
  Underline,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/ui/tabs'
import { Progress } from '@workspace/ui/components/ui/progress'
import { Slider } from '@workspace/ui/components/ui/slider'
import { Checkbox } from '@workspace/ui/components/ui/checkbox'
import { Label } from '@workspace/ui/components/ui/label'
import { Toggle } from '@workspace/ui/components/ui/toggle'
import { Separator } from '@workspace/ui/components/ui/separator'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@workspace/ui/components/ui/accordion'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/ui/dropdown-menu'
import { NotionPromptForm } from './preview-notion'

export function PreviewSandbox() {
  const [progress, setProgress] = useState(60)
  const [sliderVal, setSliderVal] = useState([40])
  // Animate progress on mount
  useState(() => {
    const timer = setTimeout(() => setProgress(72), 500)
    return () => clearTimeout(timer)
  })
  return (
    <div className="space-y-6 mt-4">
      {/* ── Buttons ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Buttons
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Danger</Button>
          <Button variant="link">Link</Button>
          <Button size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </section>
      <Separator />
      {/* ── Badges ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Badges
        </h3>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </div>
      </section>
      <Separator />
      {/* ── Card with Inputs ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Card &amp; Inputs
        </h3>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project Settings</CardTitle>
            <CardDescription>
              Update your project configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="preview-name">Name</Label>
                <Input id="preview-name" placeholder="My Project" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preview-select">Category</Label>
                <Select>
                  <SelectTrigger id="preview-select">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preview-desc">Description</Label>
              <Textarea
                id="preview-desc"
                placeholder="Brief description…"
                className="min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>
      </section>
      <Separator />
      {/* ── Tabs ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tabs
        </h3>
        <Tabs defaultValue="overview">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent
            value="overview"
            className="text-sm text-muted-foreground pt-2"
          >
            A high-level summary of project activity.
          </TabsContent>
          <TabsContent
            value="analytics"
            className="text-sm text-muted-foreground pt-2"
          >
            Charts and metrics live here.
          </TabsContent>
          <TabsContent
            value="settings"
            className="text-sm text-muted-foreground pt-2"
          >
            Configuration and preferences.
          </TabsContent>
        </Tabs>
      </section>
      <Separator />
      {/* ── Controls Row: Switch, Checkbox, Toggle, Slider ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Controls
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch id="preview-switch" defaultChecked />
              <Label htmlFor="preview-switch" className="text-sm">
                Notifications
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="preview-switch-off" />
              <Label htmlFor="preview-switch-off" className="text-sm">
                Dark mode
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="preview-check" defaultChecked />
              <Label htmlFor="preview-check" className="text-sm">
                Accept terms
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="preview-check-off" />
              <Label htmlFor="preview-check-off" className="text-sm">
                Send analytics
              </Label>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex gap-1">
              <Toggle aria-label="Bold" size="sm">
                <Bold className="h-4 w-4" />
              </Toggle>
              <Toggle aria-label="Italic" size="sm">
                <Italic className="h-4 w-4" />
              </Toggle>
              <Toggle aria-label="Underline" size="sm" defaultPressed>
                <Underline className="h-4 w-4" />
              </Toggle>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Volume —{sliderVal[0]}%</Label>
              <Slider
                value={sliderVal}
                onValueChange={setSliderVal}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Progress</Label>
              <Progress value={progress} />
            </div>
          </div>
        </div>
      </section>
      <Separator />
      {/* ── Avatars ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Avatars
        </h3>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>shadcn</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar>
                  <AvatarImage src="https://github.com/maxleiter.png" />
                  <AvatarFallback>ML</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>maxleiter</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar>
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>Fallback avatar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </section>
      <Separator />
      {/* ── Alerts ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Alerts
        </h3>
        <div className="grid gap-2">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>
              You can add components using the CLI.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong with your request.
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Changes saved successfully.</AlertDescription>
          </Alert>
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>This feature is in beta.</AlertDescription>
          </Alert>
        </div>
      </section>
      <Separator />
      {/* ── Accordion ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Accordion
        </h3>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Is it styled?</AccordionTrigger>
            <AccordionContent>
              Yes. It comes with default styles via the neumorphism CSS layer.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
      <Separator />
      {/* ── Table ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Table
        </h3>
        <div className="rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Project Alpha</TableCell>
                <TableCell>
                  <Badge variant="secondary">Active</Badge>
                </TableCell>
                <TableCell className="text-right">$2,500</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Project Beta</TableCell>
                <TableCell>
                  <Badge variant="outline">Pending</Badge>
                </TableCell>
                <TableCell className="text-right">$1,200</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Project Gamma</TableCell>
                <TableCell>
                  <Badge variant="secondary">Active</Badge>
                </TableCell>
                <TableCell className="text-right">$4,800</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
      <Separator />
      {/* ── Skeleton Loading ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Skeleton
        </h3>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </section>
      <Separator />
      {/* ── Dropdown & Popover ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Menus &amp; Popovers
        </h3>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Dropdown
                <Settings className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Popover
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Dimensions</h4>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-2">
                    <Label className="text-xs">Width</Label>
                    <Input className="col-span-2 h-8" defaultValue="100%" />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-2">
                    <Label className="text-xs">Height</Label>
                    <Input className="col-span-2 h-8" defaultValue="auto" />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </section>
      <Separator />
      {/* ── Toasts ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Toasts
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast('Default toast', {
                description: 'This is a default notification.',
              })
            }
          >
            Default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success('Success', { description: 'Operation completed.' })
            }
          >
            Success
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.error('Error', { description: 'Something went wrong.' })
            }
          >
            Error
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info('Info', { description: 'Here is some information.' })
            }
          >
            Info
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.warning('Warning', { description: 'Please be careful.' })
            }
          >
            Warning
          </Button>
        </div>
      </section>
      <Separator />
      {/* ── Prompt Form ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Prompt Form
        </h3>
        <NotionPromptForm />
      </section>
      {/* ── Neumorphic Orb ── */}
      <div className="flex flex-col items-start gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight">
            Surface Physics
          </p>
          <p className="text-muted-foreground text-sm">
            Switch to the Neumorphism preset to preview nested depth.
          </p>
        </div>
        <div className="neu-float neu-orb">
          <div className="neu-orb-inner">
            <div className="neu-orb-core" />
          </div>
        </div>
      </div>
    </div>
  )
}
