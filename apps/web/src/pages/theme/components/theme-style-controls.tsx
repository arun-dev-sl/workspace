import { Label } from '@workspace/ui/components/ui/label'
import { Slider } from '@workspace/ui/components/ui/slider'
import { Switch } from '@workspace/ui/components/ui/switch'

import { useThemeCustomization } from '@/themes/context'
import type { ThemeStyleControlId } from '@/themes/types'

import { GlassmorphicPresets } from './glassmorphic-presets'
import { NeumorphicPresets } from './neumorphic-presets'

type SliderControl = {
  type: 'slider'
  key: string
  label: string
  description: string
  min: number
  max: number
  step: number
  unit?: string
}

type ToggleControl = {
  type: 'toggle'
  key: string
  label: string
  description: string
  onValue: string
  offValue: string
}

type StyleControl = SliderControl | ToggleControl

type StyleControlsConfig = {
  title: string
  description: string
  controls: StyleControl[]
}

const STYLE_CONTROLS: Partial<Record<ThemeStyleControlId, StyleControlsConfig>> = {
  brutalism: {
    title: 'Brutalist Dial Pack',
    description: 'Push the poster attitude with blockier borders, heavier shadows, and louder surface texture.',
    controls: [
      {
        type: 'slider',
        key: '--brutal-border-width',
        label: 'Border Weight',
        description: 'Controls how heavy the card and button outlines feel.',
        min: 1,
        max: 8,
        step: 1,
        unit: 'px',
      },
      {
        type: 'slider',
        key: '--brutal-shadow-offset',
        label: 'Shadow Offset',
        description: 'Shifts the physical offset shadow further from the surface.',
        min: 2,
        max: 18,
        step: 1,
        unit: 'px',
      },
      {
        type: 'slider',
        key: '--brutal-surface-noise',
        label: 'Paper Noise',
        description: 'Adds analog grit to brutalist surfaces.',
        min: 0,
        max: 0.2,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--brutal-accent-strength',
        label: 'Accent Punch',
        description: 'Turns the secondary color blocks up or down.',
        min: 0.4,
        max: 1.4,
        step: 0.05,
      },
    ],
  },
  academia: {
    title: 'Academia Materials',
    description: 'Tune the warmth and ornament of the library-paper atmosphere.',
    controls: [
      {
        type: 'slider',
        key: '--academia-ink-softness',
        label: 'Ink Softness',
        description: 'Softens or sharpens the contrast of text and rules.',
        min: 0.65,
        max: 1.1,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--academia-rule-opacity',
        label: 'Margin Rules',
        description: 'Controls the visibility of notebook-like ruled details.',
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--academia-ornament-opacity',
        label: 'Ornament',
        description: 'Adjusts decorative serif flourishes and frame accents.',
        min: 0,
        max: 0.3,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--academia-shadow-opacity',
        label: 'Shadow Depth',
        description: 'Sets how pronounced the stacked-library card elevation feels.',
        min: 0.05,
        max: 0.28,
        step: 0.01,
      },
    ],
  },
  'retro-terminal': {
    title: 'Terminal Display',
    description: 'Dial the CRT effect from subtle command line to full-screen arcade monitor.',
    controls: [
      {
        type: 'slider',
        key: '--retro-glow',
        label: 'Glow',
        description: 'Increases phosphor bloom around active elements.',
        min: 0.2,
        max: 1.2,
        step: 0.05,
      },
      {
        type: 'slider',
        key: '--retro-scanline-opacity',
        label: 'Scanlines',
        description: 'Makes the old-display stripe pattern more or less visible.',
        min: 0,
        max: 0.35,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--retro-grid-opacity',
        label: 'Grid Noise',
        description: 'Adds raster and grid texture to the backdrop.',
        min: 0,
        max: 0.25,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--retro-screen-radius',
        label: 'Screen Radius',
        description: 'Rounds the viewport and panels like a curved monitor.',
        min: 0.2,
        max: 1.4,
        step: 0.05,
        unit: 'rem',
      },
    ],
  },
  editorial: {
    title: 'Editorial Hierarchy',
    description: 'Shape the rhythm of headlines, whitespace, and refined rules.',
    controls: [
      {
        type: 'slider',
        key: '--editorial-divider-weight',
        label: 'Rule Weight',
        description: 'Changes the thickness of section dividers and frame lines.',
        min: 1,
        max: 4,
        step: 1,
        unit: 'px',
      },
      {
        type: 'slider',
        key: '--editorial-display-scale',
        label: 'Display Scale',
        description: 'Increases or relaxes headline drama.',
        min: 1,
        max: 1.35,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--editorial-whitespace',
        label: 'Whitespace',
        description: 'Expands breathing room around key sections.',
        min: 0.8,
        max: 1.5,
        step: 0.05,
      },
      {
        type: 'slider',
        key: '--editorial-ink-contrast',
        label: 'Ink Contrast',
        description: 'Pushes the print-like contrast up or down.',
        min: 0.75,
        max: 1.2,
        step: 0.01,
      },
    ],
  },
  bauhaus: {
    title: 'Bauhaus Geometry',
    description: 'Tune the balance between rigid poster blocks and playful geometry.',
    controls: [
      {
        type: 'slider',
        key: '--bauhaus-shape-radius',
        label: 'Shape Radius',
        description: 'Moves surfaces from rigid cuts toward rounded modules.',
        min: 0.2,
        max: 2,
        step: 0.05,
        unit: 'rem',
      },
      {
        type: 'slider',
        key: '--bauhaus-block-shadow',
        label: 'Block Shadow',
        description: 'Deepens the floating poster-block effect.',
        min: 0,
        max: 0.45,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--bauhaus-accent-balance',
        label: 'Accent Balance',
        description: 'Changes how dominant the red and yellow accent layers feel.',
        min: 0.2,
        max: 0.8,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--bauhaus-grid-angle',
        label: 'Poster Tilt',
        description: 'Adds more or less diagonal tension to frames and blocks.',
        min: -10,
        max: 10,
        step: 1,
        unit: 'deg',
      },
    ],
  },
  blueprint: {
    title: 'Blueprint Overlay',
    description: 'Make the drafting atmosphere cleaner or more cinematic.',
    controls: [
      {
        type: 'slider',
        key: '--blueprint-grid-opacity',
        label: 'Grid Opacity',
        description: 'Controls the strength of the blueprint construction grid.',
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--blueprint-line-weight',
        label: 'Line Weight',
        description: 'Changes technical line thickness across frames and inputs.',
        min: 1,
        max: 3,
        step: 0.5,
        unit: 'px',
      },
      {
        type: 'slider',
        key: '--blueprint-glow',
        label: 'Cyan Glow',
        description: 'Sets the intensity of the illuminated drafting sheen.',
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        type: 'slider',
        key: '--blueprint-noise-opacity',
        label: 'Film Grain',
        description: 'Adds a little print-room texture to the blue field.',
        min: 0,
        max: 0.12,
        step: 0.01,
      },
    ],
  },
}

function parseNumericValue(value: string, fallback: number): number {
  const match = value.match(/-?\d+(\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : fallback
}

function ThemeControlField({
  control,
  value,
  onChange,
}: {
  control: StyleControl
  value?: string
  onChange: (nextValue: string) => void
}) {
  if (control.type === 'toggle') {
    return (
      <div className="rounded-xl border border-border/70 bg-card/70 p-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">{control.label}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {control.description}
            </div>
          </div>
          <Switch
            checked={(value ?? control.offValue) === control.onValue}
            onCheckedChange={(checked) =>
              onChange(checked ? control.onValue : control.offValue)
            }
          />
        </div>
      </div>
    )
  }

  const displayValue = value ?? `${control.min}${control.unit ?? ''}`

  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">{control.label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {displayValue}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {control.description}
      </p>
      <Slider
        className="mt-4"
        value={[parseNumericValue(displayValue, control.min)]}
        min={control.min}
        max={control.max}
        step={control.step}
        onValueChange={([nextValue]) =>
          onChange(`${nextValue}${control.unit ?? ''}`)
        }
      />
    </div>
  )
}

function GenericStyleControls({
  activeMode,
  controlId,
}: {
  activeMode: 'light' | 'dark'
  controlId: Exclude<ThemeStyleControlId, 'none' | 'neumorphism' | 'glassmorphism'>
}) {
  const config = STYLE_CONTROLS[controlId]
  const { overrides, setOverride, getComputedTheme } = useThemeCustomization()

  if (!config) {
    return null
  }

  const computedTheme = getComputedTheme()
  const values = activeMode === 'light' ? computedTheme.light : computedTheme.dark

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {config.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
      </div>

      <div className="grid gap-3">
        {config.controls.map((control) => {
          const value = overrides[activeMode][control.key] ?? values[control.key]

          return (
            <ThemeControlField
              key={control.key}
              control={control}
              value={value}
              onChange={(nextValue) => setOverride(activeMode, control.key, nextValue)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface ThemeStyleControlsProps {
  activeMode: 'light' | 'dark'
  controlId: ThemeStyleControlId
}

export function ThemeStyleControls({
  activeMode,
  controlId,
}: ThemeStyleControlsProps) {
  if (controlId === 'none') {
    return null
  }

  if (controlId === 'neumorphism') {
    return <NeumorphicPresets activeMode={activeMode} />
  }

  if (controlId === 'glassmorphism') {
    return <GlassmorphicPresets activeMode={activeMode} />
  }

  return <GenericStyleControls activeMode={activeMode} controlId={controlId} />
}
