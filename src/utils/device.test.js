import { describe, expect, it, vi } from 'vitest'
import { isMobile } from './device'

function withUserAgent(userAgent, callback) {
  vi.stubGlobal('navigator', { userAgent })
  try {
    callback()
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('isMobile', () => {
  it('detects mobile user agents', () => {
    withUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      () => {
        expect(isMobile()).toBe(true)
      },
    )
  })

  it('ignores desktop user agents', () => {
    withUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120.0',
      () => {
        expect(isMobile()).toBe(false)
      },
    )
  })
})
