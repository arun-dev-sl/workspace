import { useThemeCustomization } from '@/themes/context'
import { useState } from 'react'
import { FontSelector } from './font-selector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import { ColorPickerInput } from './color-picker-input'
import { SliderInput } from './slider-input'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/ui/tabs'
import { Button } from '@workspace/ui/components/ui/button'
import { Separator } from '@workspace/ui/components/ui/separator'
import { ScrollArea } from '@workspace/ui/components/ui/scroll-area'
import { CATEGORY_LABELS, THEME_VARIABLES } from '@/themes'
import { ThemeStyleControls } from './theme-style-controls'

export function ThemeEditorPanel() {
  const {
    currentPreset,
    currentPresetMeta,
    overrides,
    availablePresets,
    setPreset,
    setOverride,
    clearOverrides,
    reset,
    getComputedTheme,
  } = useThemeCustomization()

  const [activeMode, setActiveMode] = useState<'light' | 'dark'>('light')
  const [activeCategory, setActiveCategory] = useState(
    Object.keys(THEME_VARIABLES)[0],
  )

  const computedTheme = getComputedTheme()
  const currentValues =
    activeMode === 'light' ? computedTheme.light : computedTheme.dark

  const handleReset = () => {
    if (confirm('Reset all theme customizations to default?')) {
      reset()
    }
  }

  const handleClearOverrides = () => {
    if (confirm('Clear all overrides and return to preset defaults?')) {
      clearOverrides()
    }
  }

  const renderInputComponent = (variable: string, value: string) => {
    if (variable === '--font-sans') {
      return (
        <FontSelector
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          fontType="sans"
        />
      )
    }
    if (variable === '--font-serif') {
      return (
        <FontSelector
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          fontType="serif"
        />
      )
    }
    if (variable === '--font-mono') {
      return (
        <FontSelector
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          fontType="mono"
        />
      )
    }
    if (variable === '--radius') {
      return (
        <SliderInput
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          min={0}
          max={2}
          step={0.125}
          unit="rem"
        />
      )
    }
    if (variable === '--spacing') {
      return (
        <SliderInput
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          min={0}
          max={1}
          step={0.05}
          unit="rem"
        />
      )
    }
    if (variable === '--font-size-base') {
      return (
        <SliderInput
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          min={12}
          max={24}
          step={1}
          unit="px"
        />
      )
    }

    if (variable === '--tracking-normal') {
      return (
        <SliderInput
          label={variable}
          value={value}
          onChange={(newValue) => setOverride(activeMode, variable, newValue)}
          variableName={variable}
          min={-0.05}
          max={0.1}
          step={0.001}
          unit="em"
        />
      )
    }

    return (
      <ColorPickerInput
        label={variable}
        value={value}
        onChange={(newValue) => setOverride(activeMode, variable, newValue)}
        variableName={variable}
      />
    )
  }

  return (
    <div className="flex flex-col h-fit">
      <ScrollArea className="h-full">
        {/* HEADER */}
        <div className="space-y-3">
          {/* PRESET */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">Preset</label>
            <Select value={currentPreset} onValueChange={setPreset}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {availablePresets.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              {currentPresetMeta.description}
            </p>
          </div>

          {/* MODE */}
          <Tabs
            value={activeMode}
            onValueChange={(v) => setActiveMode(v as 'light' | 'dark')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="light">Light</TabsTrigger>
              <TabsTrigger value="dark">Dark</TabsTrigger>
            </TabsList>
          </Tabs>

          {currentPresetMeta.styleControlId === 'none' ? null : (
            <>
              <Separator className="my-4" />
              <ThemeStyleControls
                activeMode={activeMode}
                controlId={currentPresetMeta.styleControlId}
              />
            </>
          )}
        </div>

        <Separator className="my-4" />

        {/* BODY */}
        <div className="grid grid-cols-[100px_1fr] gap-4 flex-1 overflow-hidden">
          {/* CATEGORY SIDEBAR */}
          <div className="flex flex-col gap-1">
            {Object.keys(THEME_VARIABLES).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`text-xs px-2.5 py-1.5 rounded-md text-left transition max-w-28
                ${
                  activeCategory === category
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
                data-slot={activeCategory === category ? 'badge' : undefined}
              >
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </button>
            ))}
          </div>

          {/* VARIABLES */}
          <ScrollArea className="h-full pr-1">
            <div className="space-y-2">
              {THEME_VARIABLES[
                activeCategory as keyof typeof THEME_VARIABLES
              ].map((variable) => {
                const value = currentValues[variable] || ''
                const isOverridden = !!overrides[activeMode][variable]

                return (
                  <div key={variable} className="relative">
                    {renderInputComponent(variable, value)}
                    {isOverridden && (
                      <span
                        className="absolute -left-2 top-8 w-1.5 h-1.5 bg-primary rounded-full"
                        title="Overridden"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* FOOTER */}
        <div className="flex flex-wrap justify-between items-center gap-2 pt-3 mt-3 mb-4 border-b pb-8">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleClearOverrides}>
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {Object.keys(overrides.light).length +
              Object.keys(overrides.dark).length}{' '}
            overrides
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
