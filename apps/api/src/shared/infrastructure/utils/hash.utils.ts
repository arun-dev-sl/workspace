import { createHash } from 'node:crypto'

export function deterministicUuidFromHash(hash: string): string {
  const base = hash
    .toLowerCase()
    .replaceAll(/[^a-f0-9]/g, '')
    .padEnd(32, '0')
    .slice(0, 32)

  const part1 = base.slice(0, 8)
  const part2 = base.slice(8, 12)
  const part3 = `5${base.slice(13, 16)}`
  const variantNibble = ((Number.parseInt(base.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
  const part4 = `${variantNibble}${base.slice(17, 20)}`
  const part5 = base.slice(20, 32)

  return `${part1}-${part2}-${part3}-${part4}-${part5}`
}

export function sha256(payload: string): string {
  return createHash('sha256').update(payload).digest('hex')
}
