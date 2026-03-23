/**
 * Theme Customization Context
    *
 * Provides theme customization capabilities via React context.
 */

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react'

import { applyThemeWithPreset, mergeThemeWithOverrides } from './apply'
import { DEFAULT_PRESET_NAME } from './presets'
import { presetDefinitions, presetMetas } from './registry'
import {
    clearThemeConfig,
    loadThemeConfig,
    migrateOldThemeStorage,
    saveThemeConfig,
} from './storage'
import type { ThemeContextValue, ThemeOverrides, ThemePreset } from './types'

const ThemeCustomizationContext = createContext<ThemeContextValue | undefined>(
    undefined,
)

interface ThemeCustomizationProviderProps {
    children: ReactNode
}

export function ThemeCustomizationProvider({
    children,
}: ThemeCustomizationProviderProps) {
    // Initialize state from localStorage or defaults
    const [currentPreset, setCurrentPreset] = useState<string>(() => {
        migrateOldThemeStorage()
        const config = loadThemeConfig()
        return config?.preset ?? DEFAULT_PRESET_NAME
    })

    const [overrides, setOverrides] = useState<ThemeOverrides>(() => {
        const config = loadThemeConfig()
        return config?.overrides ?? { light: {}, dark: {} }
    })

    // Get computed theme (preset + overrides)
    const getComputedTheme = useCallback((): ThemePreset => {
        const presetDefinition =
            presetDefinitions[currentPreset] ?? presetDefinitions[DEFAULT_PRESET_NAME]
        return mergeThemeWithOverrides(presetDefinition.theme, overrides)
    }, [currentPreset, overrides])

    // Apply theme whenever it changes
    useEffect(() => {
        const theme = getComputedTheme()
        applyThemeWithPreset(theme, currentPreset)
    }, [currentPreset, getComputedTheme])

    // Persist to localStorage whenever state changes
    useEffect(() => {
        saveThemeConfig({
            preset: currentPreset,
            overrides,
        })
    }, [currentPreset, overrides])

    // Switch preset
    const setPreset = useCallback((name: string) => {
        if (!presetDefinitions[name]) {
            console.warn(`Preset "${name}" not found, using default`)
            setCurrentPreset(DEFAULT_PRESET_NAME)
            return
        }
        setCurrentPreset(name)
    }, [])

    const currentPresetMeta =
        presetDefinitions[currentPreset]?.meta ??
        presetDefinitions[DEFAULT_PRESET_NAME].meta

    // Set single override
    const setOverride = useCallback(
        (mode: 'light' | 'dark', key: string, value: string) => {
            setOverrides((prev) => ({
                ...prev,
                [mode]: {
                    ...prev[mode],
                    [key]: value,
                },
            }))
        },
        [],
    )

    // Set multiple overrides
    const setOverridesForMode = useCallback(
        (mode: 'light' | 'dark', newOverrides: Record<string, string>) => {
            setOverrides((prev) => ({
                ...prev,
                [mode]: {
                    ...prev[mode],
                    ...newOverrides,
                },
            }))
        },
        [],
    )

    // Remove specific override keys for a given mode
    const removeOverridesForMode = useCallback(
        (mode: 'light' | 'dark', keys: string[]) => {
            setOverrides((prev) => {
                const modeOverrides = { ...prev[mode] }
                for (const key of keys) {
                    delete modeOverrides[key]
                }
                return {
                    ...prev,
                    [mode]: modeOverrides,
                }
            })
        },
        [],
    )

    // Clear all overrides
    const clearOverrides = useCallback(() => {
        setOverrides({ light: {}, dark: {} })
    }, [])

    // Reset to default
    const reset = useCallback(() => {
        setCurrentPreset(DEFAULT_PRESET_NAME)
        setOverrides({ light: {}, dark: {} })
        clearThemeConfig()
    }, [])

    const value: ThemeContextValue = {
        currentPreset,
        currentPresetMeta,
        overrides,
        availablePresets: presetMetas,
        setPreset,
        setOverride,
        setOverrides: setOverridesForMode,
        removeOverrides: removeOverridesForMode,
        clearOverrides,
        reset,
        getComputedTheme,
    }

    return (
        <ThemeCustomizationContext.Provider value={value}>
            {children}
        </ThemeCustomizationContext.Provider>
    )
}

/**
 * Hook to access theme customization context
 */
export function useThemeCustomization(): ThemeContextValue {
    const context = useContext(ThemeCustomizationContext)

    if (context === undefined) {
        throw new Error(
            'useThemeCustomization must be used within a ThemeCustomizationProvider',
        )
    }

    return context
}
