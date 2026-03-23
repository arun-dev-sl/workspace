/**
 * Glassmorphic Presets Component
 *
 * Provides tint-color presets and adjustable controls specifically for the
 * glassmorphism theme. Only displays when the glassmorphism preset is active.
 *
 * Inspired by Apple's Liquid Glass design language:
 *   - translucent tinted surfaces
 *   - backdrop-filter blur + saturate
 *   - thin luminous borders
 *   - specular highlight edges
 */

import { useEffect, useState } from 'react'
import { Label } from '@workspace/ui/components/ui/label'
import { Switch } from '@workspace/ui/components/ui/switch'
import { Slider } from '@workspace/ui/components/ui/slider'
import { useThemeCustomization } from '@/themes/context'
import { Badge } from '@workspace/ui/components/ui/badge'

// ── Glass-specific CSS variables that must be cleaned up ───────────
const GLASSMORPHIC_VARIABLES = [
  '--glass-blur',
  '--glass-surface-opacity',
  '--glass-saturation',
  '--glass-border-opacity',
  '--glass-border-radius',
  '--glass-tint',
  '--glass-shadow',
  '--glass-highlight',
  '--glass-noise-opacity',
  '--glass-specular',
]

// Standard shadow overrides that the glass preset also sets
const GLASSMORPHIC_SHADOW_OVERRIDES = [
  '--shadow',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-xl',
  '--shadow-2xl',
  '--shadow-xs',
  '--shadow-2xs',
]

const GLASSMORPHIC_COLOR_OVERRIDES = [
  '--background',
  '--card',
  '--input',
  '--secondary',
  '--popover',
  '--sidebar',
]

// All variables set by glassmorphic preset toggling
const ALL_GLASSMORPHIC_OVERRIDES = [
  ...GLASSMORPHIC_VARIABLES,
  ...GLASSMORPHIC_SHADOW_OVERRIDES,
  ...GLASSMORPHIC_COLOR_OVERRIDES,
]

// ── Tint presets ───────────────────────────────────────────────────
//
// Design principles for glass-compatible presets:
//
//   1. TINT is the color of the glass pane itself — always pale/light.
//      Dark tints (e.g. rgb(30,41,59)) make the surface opaque, not glassy.
//      For "dark glass", keep the tint light and darken the BACKGROUND instead.
//
//   2. BACKGROUND must have enough color richness for the backdrop-filter
//      blur to be perceptible. A flat #ffffff background makes blur invisible.
//      Slightly saturated or tinted backgrounds give the blur something to work with.
//
//   3. DARK MODE backgrounds for dark glass presets should be near-black
//      with a color cast — the light tint over near-black creates the glass depth.
//
// ── 18 presets in 6 families ──────────────────────────────────────
const GLASSMORPHIC_PRESETS = [
  // ── I. CLEAR ──────────────────────────────────────────────────────
  // Pure whites and silvers. The reference Apple glass feel.
  {
    name: 'Crystal',
    tint: '255, 255, 255',
    background: { light: '#f0f4f8', dark: '#0f172a' },
    accent: '#e2e8f0',
    description: 'Clean clear glass',
  },
  {
    name: 'Silver',
    // Slightly cool desaturated white — architectural glass / stainless
    tint: '214, 224, 236',
    background: { light: '#dde5ef', dark: '#111827' },
    accent: '#94a3b8',
    description: 'Cool metallic silver',
  },
  {
    name: 'Pearl',
    // Warm white with a faint creamy cast — like polished nacre
    tint: '255, 251, 242',
    background: { light: '#f5f0e8', dark: '#1c1a16' },
    accent: '#e7dfc8',
    description: 'Warm pearlescent white',
  },

  // ── II. WATER ─────────────────────────────────────────────────────
  // Blues and aquas — the most naturally glass-like color family.
  // These work because water IS glass in a physical sense.
  {
    name: 'Glacial',
    // Near-white with just a breath of cold blue — ice/glacier
    tint: '219, 236, 255',
    background: { light: '#dbeafe', dark: '#0c1929' },
    accent: '#93c5fd',
    description: 'Cold clear ice blue',
  },
  {
    name: 'Tide',
    // Bright sky-water — Caribbean shallows, swimming pools
    tint: '147, 210, 255',
    background: { light: '#bae6fd', dark: '#082f49' },
    accent: '#38bdf8',
    description: 'Bright sky-water blue',
  },
  {
    name: 'Abyss',
    // Deeper cobalt — open ocean, deep water glass
    tint: '165, 193, 253',
    background: { light: '#c7d7fe', dark: '#1e3a5f' },
    accent: '#6366f1',
    description: 'Deep cobalt ocean',
  },

  // ── III. GARDEN ──────────────────────────────────────────────────
  // Greens and teals. Sea glass, celadon, morning mist.
  {
    name: 'Sea Glass',
    // The exact teal-green of beach-worn frosted glass — iconic
    tint: '148, 240, 220',
    background: { light: '#ccfbf1', dark: '#042f2e' },
    accent: '#2dd4bf',
    description: 'Worn sea glass teal',
  },
  {
    name: 'Celadon',
    // Pale grey-green — Chinese celadon glaze, very refined
    tint: '187, 247, 208',
    background: { light: '#dcfce7', dark: '#052e16' },
    accent: '#4ade80',
    description: 'Soft celadon jade',
  },
  {
    name: 'Dew',
    // Almost-clear with green undertone — morning light through leaves
    tint: '220, 252, 231',
    background: { light: '#ecfdf5', dark: '#0a2818' },
    accent: '#6ee7b7',
    description: 'Morning dew on glass',
  },

  // ── IV. DUSK ─────────────────────────────────────────────────────
  // Pinks, corals, ambers. Warm sunset light through glass.
  {
    name: 'Petal',
    // Rose-pink — delicate, feminine, like light through pink quartz
    tint: '252, 207, 232',
    background: { light: '#fce7f3', dark: '#2d0a1e' },
    accent: '#f472b6',
    description: 'Soft rose petal pink',
  },
  {
    name: 'Coral',
    // Warm coral-orange — sunset glass, terracotta light
    tint: '254, 178, 152',
    background: { light: '#ffedd5', dark: '#1f0a00' },
    accent: '#fb923c',
    description: 'Warm coral sunset',
  },
  {
    name: 'Honey',
    // Golden amber — like warm light through antique glass
    tint: '253, 224, 132',
    background: { light: '#fef9c3', dark: '#1a1000' },
    accent: '#fbbf24',
    description: 'Warm amber honey',
  },

  // ── V. MINERAL ───────────────────────────────────────────────────
  // Violets and purples. Gemstones, amethyst, stained glass.
  {
    name: 'Wisteria',
    // Pale lilac — wisteria petals, morning haze
    tint: '237, 217, 254',
    background: { light: '#f3e8ff', dark: '#1a0a2e' },
    accent: '#c084fc',
    description: 'Pale lilac wisteria',
  },
  {
    name: 'Amethyst',
    // Mid-purple — rich gem, cathedral glass
    tint: '204, 181, 253',
    background: { light: '#ede9fe', dark: '#2e1065' },
    accent: '#a78bfa',
    description: 'Rich amethyst gem',
  },
  {
    name: 'Iris',
    // Blue-violet — the periwinkle between blue and purple
    tint: '183, 198, 253',
    background: { light: '#eef2ff', dark: '#1e1b4b' },
    accent: '#818cf8',
    description: 'Blue-violet iris',
  },

  // ── VI. NIGHT GLASS ───────────────────────────────────────────────
  // Two dark glass techniques:
  //
  // (a) PALE TINT on dark background — transparency reveals depth,
  //     color comes from behind the glass. Apple dark mode reference.
  //
  // (b) DARK TINT on very dark background — the glass surface IS dark.
  //     Specular highlight becomes the entire visual payoff: a bright
  //     white caustic streak on near-black glass, like polished obsidian,
  //     a phone screen at an angle, or smoked architectural glass.
  //     Needs surface opacity ~0.55–0.75 to read; specular must be ON.

  // — (a) Pale tint on dark bg ——————————————————————————————————————
  {
    name: 'Midnight',
    // Cool blue-white tint on deep navy — Apple dark mode glass
    tint: '200, 220, 255',
    background: { light: '#1e293b', dark: '#020617' },
    accent: '#3b82f6',
    description: 'Dark navy with pale glass',
  },
  {
    name: 'Aurora',
    // Pale violet-white on near-black — northern lights behind frosted glass
    tint: '225, 215, 255',
    background: { light: '#1e1b4b', dark: '#030010' },
    accent: '#818cf8',
    description: 'Violet glow through glass',
  },
  {
    name: 'Ember',
    // Warm pale tint on dark brown-black — candlelight through smoked glass
    tint: '245, 232, 215',
    background: { light: '#292524', dark: '#0c0a09' },
    accent: '#78716c',
    description: 'Warm candlelit dark glass',
  },

  // — (b) Dark tint — specular is the payoff ————————————————————————
  {
    name: 'Onyx',
    // Deep navy-black tint on near-black bg — polished onyx stone.
    // The specular streak glows brilliant white on this dark surface.
    tint: '15, 23, 42',
    background: { light: '#0f172a', dark: '#020617' },
    accent: '#1e293b',
    description: 'Polished dark onyx, white specular',
  },
  {
    name: 'Carbon',
    // Near-neutral charcoal tint — carbon fibre, smoked architectural glass
    tint: '28, 32, 38',
    background: { light: '#18181b', dark: '#09090b' },
    accent: '#27272a',
    description: 'Carbon smoke, edge glow',
  },
  {
    name: 'Slate',
    // Cool dark slate — slate roof tile, high-end matte glass
    tint: '44, 55, 72',
    background: { light: '#0f172a', dark: '#050c18' },
    accent: '#334155',
    description: 'Cool dark slate mirror',
  },
] as const

type GlassPreset = (typeof GLASSMORPHIC_PRESETS)[number]

// ── Apply a glass tint preset to theme overrides ──────────────────

function applyGlassPresetToTheme(
  preset: GlassPreset,
  mode: 'light' | 'dark',
  setOverride: (mode: 'light' | 'dark', key: string, value: string) => void,
  blurIntensity: number,
  surfaceOpacity: number,
  saturation: number,
  borderOpacity: number,
  specularEnabled: boolean,
) {
  const bg = mode === 'light' ? preset.background.light : preset.background.dark

  // Apply background colors — glass needs a consistent base behind the blur
  setOverride(mode, '--background', bg)
  setOverride(mode, '--card', bg)
  setOverride(mode, '--input', bg)
  setOverride(mode, '--secondary', bg)
  setOverride(mode, '--popover', bg)
  setOverride(mode, '--sidebar', bg)

  // Apply glass-specific variables
  setOverride(mode, '--glass-tint', preset.tint)
  setOverride(mode, '--glass-blur', `${blurIntensity}px`)
  setOverride(mode, '--glass-surface-opacity', surfaceOpacity.toString())
  setOverride(mode, '--glass-saturation', saturation.toString())
  setOverride(mode, '--glass-border-opacity', borderOpacity.toString())
  setOverride(mode, '--glass-specular', specularEnabled ? '1' : '0')

  // Compute shadow intensity based on mode
  const shadowAlpha = mode === 'light' ? 0.08 : 0.36
  setOverride(
    mode,
    '--glass-shadow',
    `0 8px 32px rgba(0, 0, 0, ${shadowAlpha})`,
  )

  // Highlight edge strength
  const highlightAlpha = mode === 'light' ? 0.35 : 0.12
  setOverride(
    mode,
    '--glass-highlight',
    specularEnabled
      ? `inset 0 1px 0 rgba(255, 255, 255, ${highlightAlpha})`
      : 'none',
  )

  // Standard shadow overrides (soft, diffuse — glass style)
  const baseAlpha = mode === 'light' ? 0.06 : 0.2
  setOverride(
    mode,
    '--shadow-2xs',
    `0 1px 2px rgba(0, 0, 0, ${(baseAlpha * 0.6).toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow-xs',
    `0 1px 3px rgba(0, 0, 0, ${baseAlpha.toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow-sm',
    `0 2px 8px rgba(0, 0, 0, ${baseAlpha.toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow',
    `0 4px 16px rgba(0, 0, 0, ${baseAlpha.toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow-md',
    `0 8px 32px rgba(0, 0, 0, ${(baseAlpha * 1.3).toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow-lg',
    `0 12px 40px rgba(0, 0, 0, ${(baseAlpha * 1.7).toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow-xl',
    `0 16px 48px rgba(0, 0, 0, ${(baseAlpha * 2).toFixed(3)})`,
  )
  setOverride(
    mode,
    '--shadow-2xl',
    `0 24px 64px rgba(0, 0, 0, ${(baseAlpha * 2.7).toFixed(3)})`,
  )
}

// ── Component ─────────────────────────────────────────────────────

interface GlassmorphicPresetsProps {
  activeMode: 'light' | 'dark'
}

// ── Helper — detects dark-tint presets (the "mirror glass" family) ──
// Parses the "R, G, B" tint string and checks if all channels are low.
// Onyx (15,23,42), Carbon (28,32,38), Slate (44,55,72) all pass.
// The threshold of 80 ensures no false positives from the color presets.
function isDarkTint(tint: string): boolean {
  const [r, g, b] = tint.split(',').map(Number)
  return r < 80 && g < 80 && b < 80
}

// Family metadata for section headers
const PRESET_FAMILIES = [
  { label: 'Clear', start: 0, count: 3 },
  { label: 'Water', start: 3, count: 3 },
  { label: 'Garden', start: 6, count: 3 },
  { label: 'Dusk', start: 9, count: 3 },
  { label: 'Mineral', start: 12, count: 3 },
  { label: 'Night Glass', start: 15, count: 6 },
] as const

export function GlassmorphicPresets({ activeMode }: GlassmorphicPresetsProps) {
  const { setOverride, overrides, currentPreset, removeOverrides } =
    useThemeCustomization()

  const [selectedPreset, setSelectedPreset] = useState<GlassPreset | null>(null)

  // Adjustable parameters
  const [blurIntensity, setBlurIntensity] = useState(18) // px, 4–40
  const [surfaceOpacity, setSurfaceOpacity] = useState(0.42) // 0.1–0.8
  const [saturation, setSaturation] = useState(2.0) // 1.0–3.0
  const [borderOpacity, setBorderOpacity] = useState(0.22) // 0.0–0.5
  const [specularEnabled, setSpecularEnabled] = useState(true)

  // ── Cleanup on preset switch ──────────────────────────────────
  useEffect(() => {
    if (currentPreset !== 'glassmorphism') {
      const hasGlassmorphicOverrides = (['light', 'dark'] as const).some(
        (mode) =>
          ALL_GLASSMORPHIC_OVERRIDES.some(
            (variable) => overrides[mode][variable],
          ),
      )

      if (hasGlassmorphicOverrides) {
        removeOverrides('light', ALL_GLASSMORPHIC_OVERRIDES)
        removeOverrides('dark', ALL_GLASSMORPHIC_OVERRIDES)
        setSelectedPreset(null)
      }
    }
  }, [currentPreset, overrides, removeOverrides])

  // ── Handlers ──────────────────────────────────────────────────
  const applyCurrentSettings = (
    preset: GlassPreset,
    mode: 'light' | 'dark',
    blur = blurIntensity,
    opacity = surfaceOpacity,
    sat = saturation,
    border = borderOpacity,
    specular = specularEnabled,
  ) => {
    applyGlassPresetToTheme(
      preset,
      mode,
      setOverride,
      blur,
      opacity,
      sat,
      border,
      specular,
    )
  }

  const handlePresetClick = (preset: GlassPreset) => {
    setSelectedPreset(preset)
    applyCurrentSettings(preset, activeMode)
  }

  const handleBlurChange = (value: number[]) => {
    const blur = value[0]
    setBlurIntensity(blur)
    if (selectedPreset) applyCurrentSettings(selectedPreset, activeMode, blur)
  }

  const handleOpacityChange = (value: number[]) => {
    const opacity = value[0]
    setSurfaceOpacity(opacity)
    if (selectedPreset)
      applyCurrentSettings(selectedPreset, activeMode, blurIntensity, opacity)
  }

  const handleSaturationChange = (value: number[]) => {
    const sat = value[0]
    setSaturation(sat)
    if (selectedPreset)
      applyCurrentSettings(
        selectedPreset,
        activeMode,
        blurIntensity,
        surfaceOpacity,
        sat,
      )
  }

  const handleBorderOpacityChange = (value: number[]) => {
    const border = value[0]
    setBorderOpacity(border)
    if (selectedPreset)
      applyCurrentSettings(
        selectedPreset,
        activeMode,
        blurIntensity,
        surfaceOpacity,
        saturation,
        border,
      )
  }

  const handleSpecularToggle = (checked: boolean) => {
    setSpecularEnabled(checked)
    if (selectedPreset)
      applyCurrentSettings(
        selectedPreset,
        activeMode,
        blurIntensity,
        surfaceOpacity,
        saturation,
        borderOpacity,
        checked,
      )
  }

  // Re-apply when activeMode changes
  useEffect(() => {
    if (selectedPreset) applyCurrentSettings(selectedPreset, activeMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode])

  return (
    <div className="space-y-5">
      {/* ── Tint Preset Grid — grouped by family ────────────── */}
      <div className="space-y-4">
        <Label className="text-xs text-muted-foreground block">
          Glass Tint Presets
        </Label>

        {PRESET_FAMILIES.map((family) => (
          <div key={family.label}>
            {/* Family label */}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              {family.label}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {GLASSMORPHIC_PRESETS.slice(
                family.start,
                family.start + family.count,
              ).map((preset) => (
                <Badge
                  variant="outline"
                  key={preset.name}
                  onClick={() => handlePresetClick(preset)}
                  className={`group relative flex flex-col items-center gap-2 p-3 pt-5 rounded-lg hover:bg-muted transition cursor-pointer ${
                    selectedPreset?.name === preset.name
                      ? 'ring-2 ring-primary ring-offset-1'
                      : ''
                  }`}
                  title={preset.description}
                >
                  {/* Swatch — layered to show the glass tint over a colored bg */}
                  <div className="relative w-11 h-11 rounded-full overflow-hidden">
                    {/* Background layer — shows what will be behind the glass */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          activeMode === 'dark'
                            ? preset.background.dark
                            : preset.background.light,
                      }}
                    />
                    {/* Glass tint layer */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `rgba(${preset.tint}, ${
                          isDarkTint(preset.tint)
                            ? Math.max(surfaceOpacity, 0.6)
                            : surfaceOpacity
                        })`,
                        backdropFilter: `blur(${blurIntensity}px) saturate(${saturation})`,
                        WebkitBackdropFilter: `blur(${blurIntensity}px) saturate(${saturation})`,
                        border: `1px solid rgba(255,255,255,${borderOpacity * 1.5})`,
                      }}
                    />
                    {/* Specular highlight */}
                    {specularEnabled && (
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%)',
                        }}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-medium leading-tight text-center">
                    {preset.name}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Adjustable Controls ─────────────────────────────── */}
      <div className="space-y-4 pt-1">
        <Label className="text-xs text-muted-foreground block">
          Glass Controls
        </Label>

        {/* Blur Intensity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Blur Intensity</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {blurIntensity}px
            </span>
          </div>
          <Slider
            min={4}
            max={40}
            step={2}
            value={[blurIntensity]}
            onValueChange={handleBlurChange}
          />
          <p className="text-xs text-muted-foreground">
            Backdrop blur radius — higher values create a more frosted look
          </p>
        </div>

        {/* Surface Opacity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Glass Opacity</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {(surfaceOpacity * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            min={0.1}
            max={0.8}
            step={0.05}
            value={[surfaceOpacity]}
            onValueChange={handleOpacityChange}
          />
          <p className="text-xs text-muted-foreground">
            Transparency of glass surfaces — lower is more see-through
          </p>
        </div>

        {/* Backdrop Saturation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Backdrop Saturation</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {saturation.toFixed(1)}×
            </span>
          </div>
          <Slider
            min={1.0}
            max={3.0}
            step={0.1}
            value={[saturation]}
            onValueChange={handleSaturationChange}
          />
          <p className="text-xs text-muted-foreground">
            Color vibrancy of what shows through the glass
          </p>
        </div>

        {/* Border Luminance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Border Luminance</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {(borderOpacity * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            min={0}
            max={0.5}
            step={0.05}
            value={[borderOpacity]}
            onValueChange={handleBorderOpacityChange}
          />
          <p className="text-xs text-muted-foreground">
            Brightness of the thin luminous glass edge
          </p>
        </div>
      </div>

      {/* ── Toggles ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="specular-toggle" className="text-sm font-medium">
              Specular Highlight
            </Label>
            <p className="text-xs text-muted-foreground">
              {specularEnabled
                ? 'Diagonal caustic reflection active'
                : 'No specular reflection'}
            </p>
          </div>
          <Switch
            id="specular-toggle"
            checked={specularEnabled}
            onCheckedChange={handleSpecularToggle}
          />
        </div>
      </div>

      {/* ── Live Preview ────────────────────────────────────── */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">
          Preview
        </Label>

        {/* Dark-tint hint — shown only for Onyx/Carbon/Slate family */}
        {selectedPreset != null &&
          isDarkTint(selectedPreset.tint) &&
          !specularEnabled && (
            <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
              Tip: enable Specular Highlight to see the light-on-dark effect
              that makes this preset distinctive.
            </p>
          )}

        <div
          className="flex items-center justify-center p-8 rounded-lg relative overflow-hidden"
          style={{
            // Always use the actual preset background so the blur has something real to blur
            background:
              selectedPreset != null
                ? activeMode === 'light'
                  ? selectedPreset.background.light
                  : selectedPreset.background.dark
                : activeMode === 'light'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
          }}
        >
          {(() => {
            const preset = selectedPreset ?? GLASSMORPHIC_PRESETS[0]
            const dark = isDarkTint(preset.tint)
            // Dark-tint presets look better with higher opacity so the
            // tinted surface is perceptible before the specular fires
            const effectiveOpacity = dark
              ? Math.max(surfaceOpacity, 0.55)
              : surfaceOpacity
            // Text color: light on dark-tint glass, dark on pale-tint glass
            const textColor = dark
              ? '#e2e8f0'
              : activeMode === 'light'
                ? '#0f172a'
                : '#f1f5f9'
            const subColor = dark
              ? 'rgba(226,232,240,0.55)'
              : activeMode === 'light'
                ? 'rgba(15,23,42,0.55)'
                : 'rgba(241,245,249,0.55)'
            // Specular is more dramatic on dark glass — crank it up in preview
            const specularStrength = dark ? 0.32 : 0.2
            const specularFade = dark ? 0.14 : 0.08

            return (
              <div
                className="w-44 h-28 rounded-2xl relative overflow-hidden flex flex-col items-start justify-end p-4 gap-1"
                style={{
                  background: `rgba(${preset.tint}, ${effectiveOpacity})`,
                  backdropFilter: `blur(${blurIntensity}px) saturate(${saturation})`,
                  WebkitBackdropFilter: `blur(${blurIntensity}px) saturate(${saturation})`,
                  border: `1px solid rgba(255, 255, 255, ${borderOpacity * 1.8})`,
                  boxShadow: `
                    0 8px 32px rgba(0, 0, 0, ${dark ? 0.55 : activeMode === 'light' ? 0.1 : 0.38}),
                    inset 0 1px 0 rgba(255,255,255,${borderOpacity * 1.4})
                  `,
                }}
              >
                {/* Specular diagonal caustic — more visible on dark glass */}
                {specularEnabled && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, rgba(255,255,255,${specularStrength}) 0%, rgba(255,255,255,${specularFade}) 22%, transparent 45%)`,
                    }}
                  />
                )}
                {/* Gradient border */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    padding: '1px',
                    background: `linear-gradient(145deg, rgba(255,255,255,${borderOpacity * 2.8}), rgba(255,255,255,${borderOpacity * 0.3}) 50%, rgba(255,255,255,${borderOpacity * 0.7}))`,
                    WebkitMask:
                      'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'destination-out',
                    maskComposite: 'exclude',
                  }}
                />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest relative z-10"
                  style={{ color: subColor }}
                >
                  {preset.name}
                </span>
                <span
                  className="text-sm font-medium relative z-10 leading-tight"
                  style={{ color: textColor }}
                >
                  Liquid Glass
                </span>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
