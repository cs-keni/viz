import { describe, it, expect } from 'vitest'
import { parseNodeHash } from './parseNodeHash'

describe('parseNodeHash', () => {
  it('returns null for empty string', () => {
    expect(parseNodeHash('')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(parseNodeHash(null)).toBeNull()
    expect(parseNodeHash(undefined)).toBeNull()
  })

  it('returns null for unrelated hash', () => {
    expect(parseNodeHash('#other=foo')).toBeNull()
  })

  it('returns null for bare hash', () => {
    expect(parseNodeHash('#')).toBeNull()
  })

  it('decodes a URL-encoded node id with slash and space', () => {
    expect(parseNodeHash('#node=Projects%2FBobby%20Brain%20Viz'))
      .toBe('Projects/Bobby Brain Viz')
  })

  it('handles plain id without encoding', () => {
    expect(parseNodeHash('#node=SomeNote')).toBe('SomeNote')
  })

  it('handles empty id after prefix', () => {
    expect(parseNodeHash('#node=')).toBe('')
  })

  it('returns null for malformed percent encoding', () => {
    expect(parseNodeHash('#node=%ZZ')).toBeNull()
  })
})
