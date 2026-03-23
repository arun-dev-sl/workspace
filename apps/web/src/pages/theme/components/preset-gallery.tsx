import { Badge } from '@workspace/ui/components/ui/badge'

import type { ThemePresetMeta } from '@/themes'

interface PresetGalleryProps {
  presets: ThemePresetMeta[]
  currentPreset: string
  onSelect: (presetName: string) => void
}

function SwatchRow({ colors, label }: { colors: string[]; label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="flex gap-1.5">
        {colors.map((color, index) => (
          <span
            key={`${label}-${index}`}
            className="h-4 flex-1 rounded-full border border-border/60"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}

export function PresetGallery({
  presets,
  currentPreset,
  onSelect,
}: PresetGalleryProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Theme Gallery
          </p>
          <p className="text-sm text-muted-foreground">
            Pick a visual language, then fine-tune it below.
          </p>
        </div>
        <Badge variant="outline" className="w-25">
          {presets.length} presets
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {presets.map((preset) => {
          const isActive = preset.name === currentPreset

          return (
            <button
              key={preset.name}
              type="button"
              data-slot="card"
              onClick={() => onSelect(preset.name)}
              className={[
                'rounded-2xl border p-3 text-left transition-all',
                isActive
                  ? 'border-primary bg-accent/40 shadow-sm'
                  : 'border-border/70 bg-card hover:border-primary/40 hover:bg-accent/15',
              ].join(' ')}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{preset.label}</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {preset.family}
                  </div>
                </div>
                {preset.styleControlId === 'none' ? (
                  <Badge variant="secondary" className="text-[8px]">
                    Token
                  </Badge>
                ) : (
                  <Badge className="text-[8px]">{preset.tags[0]}</Badge>
                )}
              </div>

              <div className="space-y-2">
                <SwatchRow colors={preset.preview.light} label="Light" />
                <SwatchRow colors={preset.preview.dark} label="Dark" />
              </div>

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {preset.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
