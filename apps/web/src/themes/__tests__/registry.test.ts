import { describe, expect, it } from 'vitest'

import { presetDefinitions, presetMetas } from '../registry'

describe('theme preset registry', () => {
  it('exposes metadata for every preset key', () => {
    const definitionKeys = Object.keys(presetDefinitions)
    const metaKeys = presetMetas.map((meta) => meta.name)

    expect(metaKeys).toEqual(definitionKeys)
  })

  it('registers the new expressive theme pack with style loaders', () => {
    for (const presetName of [
      'brutalism',
      'academia',
      'retro-terminal',
      'editorial',
      'bauhaus',
      'blueprint',
    ]) {
      const definition = presetDefinitions[presetName]

      expect(definition).toBeDefined()
      expect(definition.meta.styleControlId).not.toBe('none')
      expect(definition.loadStyles).toBeTypeOf('function')
      expect(definition.cleanupPrefixes?.length).toBeGreaterThan(0)
      expect(definition.meta.preview.light).toHaveLength(3)
      expect(definition.meta.preview.dark).toHaveLength(3)
    }
  })
})
