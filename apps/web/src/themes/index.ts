/**
 * Theme System Module
 *
 * Public API exports for the Workspace theme system.
 */

// Types
export type {
  ThemeConfig,
  ThemeContextValue,
  ThemePresetDefinition,
  ThemePresetMeta,
  ThemeOverrides,
  ThemePreset,
} from "./types";
export { ALL_THEME_VARIABLES, CATEGORY_LABELS, THEME_VARIABLES } from "./types";

// Presets
export { DEFAULT_PRESET_NAME, presets } from "./presets";
export { presetDefinitions, presetMetas, STYLE_PRESET_NAMES } from "./registry";

// Context and hooks
export { ThemeCustomizationProvider, useThemeCustomization } from "./context";

// Utilities (for advanced use cases)
export { applyTheme, applyThemeWithPreset, mergeThemeWithOverrides } from "./apply";
export {
  clearThemeConfig,
  getDefaultConfig,
  loadThemeConfig,
  saveThemeConfig,
} from "./storage";
