import { presets } from './presets'
import type {
  ThemePreset,
  ThemePresetDefinition,
  ThemePresetMeta,
} from './types'

function titleCasePresetName(name: string): string {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildPreview(theme: ThemePreset) {
  return {
    light: [
      theme.light['--background'],
      theme.light['--primary'],
      theme.light['--accent'],
    ],
    dark: [
      theme.dark['--background'],
      theme.dark['--primary'],
      theme.dark['--accent'],
    ],
  }
}

const EXPRESSIVE_PRESET_DETAILS: Partial<
  Record<
    string,
    Omit<ThemePresetMeta, 'name' | 'preview'> & {
      cleanupPrefixes?: string[]
      loadStyles?: () => Promise<unknown>
    }
  >
> = {
  neumorphism: {
    label: 'Neumorphism',
    description: 'Soft extruded surfaces with tactile depth and gentle shadows.',
    family: 'expressive',
    tags: ['soft', 'depth', 'tactile'],
    styleControlId: 'neumorphism',
    cleanupPrefixes: ['--neu-'],
    loadStyles: () => import('@workspace/ui/styles/neumorphism.css'),
  },
  glassmorphism: {
    label: 'Glassmorphism',
    description: 'Translucent panels, blur, and luminous edges inspired by frosted glass.',
    family: 'expressive',
    tags: ['glass', 'blur', 'luminous'],
    styleControlId: 'glassmorphism',
    cleanupPrefixes: ['--glass-'],
    loadStyles: () => import('@workspace/ui/styles/glassmorphism.css'),
  },
  brutalism: {
    label: 'Brutalism',
    description: 'Blocky contrast, thick borders, poster colors, and raw physical shadows.',
    family: 'expressive',
    tags: ['bold', 'poster', 'raw'],
    styleControlId: 'brutalism',
    cleanupPrefixes: ['--brutal-'],
    loadStyles: () => import('@workspace/ui/styles/brutalism.css'),
  },
  academia: {
    label: 'Academia',
    description: 'Warm paper tones, literary serif typography, and annotated notebook details.',
    family: 'expressive',
    tags: ['paper', 'serif', 'scholarly'],
    styleControlId: 'academia',
    cleanupPrefixes: ['--academia-'],
    loadStyles: () => import('@workspace/ui/styles/academia.css'),
  },
  'retro-terminal': {
    label: 'Retro Terminal',
    description: 'Phosphor display glow, scanlines, and monochrome command-line energy.',
    family: 'expressive',
    tags: ['crt', 'terminal', 'retro'],
    styleControlId: 'retro-terminal',
    cleanupPrefixes: ['--retro-'],
    loadStyles: () => import('@workspace/ui/styles/retro-terminal.css'),
  },
  editorial: {
    label: 'Editorial',
    description: 'Magazine hierarchy, sharp type contrast, and restrained luxury framing.',
    family: 'expressive',
    tags: ['magazine', 'typography', 'luxury'],
    styleControlId: 'editorial',
    cleanupPrefixes: ['--editorial-'],
    loadStyles: () => import('@workspace/ui/styles/editorial.css'),
  },
  bauhaus: {
    label: 'Bauhaus',
    description: 'Geometric surfaces, primary colors, and playful asymmetry.',
    family: 'expressive',
    tags: ['geometry', 'poster', 'color-block'],
    styleControlId: 'bauhaus',
    cleanupPrefixes: ['--bauhaus-'],
    loadStyles: () => import('@workspace/ui/styles/bauhaus.css'),
  },
  blueprint: {
    label: 'Blueprint',
    description: 'Drafting-grid surfaces, cyan utility lines, and technical dashboard contrast.',
    family: 'expressive',
    tags: ['technical', 'grid', 'cyan'],
    styleControlId: 'blueprint',
    cleanupPrefixes: ['--blueprint-'],
    loadStyles: () => import('@workspace/ui/styles/blueprint.css'),
  },
}

function createDefinition(name: string, theme: ThemePreset): ThemePresetDefinition {
  const expressiveDetails = EXPRESSIVE_PRESET_DETAILS[name]

  return {
    meta: {
      name,
      label: expressiveDetails?.label ?? titleCasePresetName(name),
      description:
        expressiveDetails?.description ??
        `${titleCasePresetName(name)} preset for the workspace theme system.`,
      family: expressiveDetails?.family ?? 'classic',
      tags: expressiveDetails?.tags ?? ['token'],
      preview: buildPreview(theme),
      styleControlId: expressiveDetails?.styleControlId ?? 'none',
    },
    theme,
    cleanupPrefixes: expressiveDetails?.cleanupPrefixes,
    loadStyles: expressiveDetails?.loadStyles,
  }
}

export const presetDefinitions: Record<string, ThemePresetDefinition> =
  Object.fromEntries(
    Object.entries(presets).map(([name, theme]) => [name, createDefinition(name, theme)]),
  )

export const presetMetas: ThemePresetMeta[] = Object.values(presetDefinitions).map(
  ({ meta }) => meta,
)

export const STYLE_PRESET_NAMES = new Set<string>(
  presetMetas.filter((meta) => meta.styleControlId !== 'none').map((meta) => meta.name),
)
