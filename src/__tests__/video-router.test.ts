import { describe, it, expect, beforeEach } from 'vitest'
import {
  isKlingQuotaError,
  isKlingApiError,
  getKlingErrorMessage,
  isProviderAvailable,
  blockProvider,
  getActiveProvider,
  classifyKlingResponse,
} from '@/lib/video-router'

// ── isKlingQuotaError ─────────────────────────────────────────────────────────

describe('isKlingQuotaError', () => {
  it('returns true for code 1600039 (insufficient balance)', () => {
    expect(isKlingQuotaError({ code: 1600039, message: 'Insufficient balance' })).toBe(true)
  })

  it('returns true for code 1600040 (quota exceeded)', () => {
    expect(isKlingQuotaError({ code: 1600040 })).toBe(true)
  })

  it('returns true for code 1600037 (API limit)', () => {
    expect(isKlingQuotaError({ code: 1600037 })).toBe(true)
  })

  it('returns false for code 0 (success)', () => {
    expect(isKlingQuotaError({ code: 0 })).toBe(false)
  })

  it('returns false for other error codes', () => {
    expect(isKlingQuotaError({ code: 1500001 })).toBe(false)
  })

  it('returns false for null / undefined', () => {
    expect(isKlingQuotaError(null)).toBe(false)
    expect(isKlingQuotaError(undefined)).toBe(false)
    expect(isKlingQuotaError({})).toBe(false)
  })
})

// ── isKlingApiError ───────────────────────────────────────────────────────────

describe('isKlingApiError', () => {
  it('returns true for any non-zero code', () => {
    expect(isKlingApiError({ code: 1500001 })).toBe(true)
    expect(isKlingApiError({ code: 1600039 })).toBe(true)
  })

  it('returns false for code 0 (success)', () => {
    expect(isKlingApiError({ code: 0 })).toBe(false)
  })

  it('returns false when code is missing', () => {
    expect(isKlingApiError({})).toBe(false)
    expect(isKlingApiError(null)).toBe(false)
  })
})

// ── getKlingErrorMessage ──────────────────────────────────────────────────────

describe('getKlingErrorMessage', () => {
  it('returns the message field when present', () => {
    expect(getKlingErrorMessage({ code: 1600039, message: 'Insufficient balance' }))
      .toBe('Insufficient balance')
  })

  it('returns fallback string when message is missing', () => {
    expect(getKlingErrorMessage({})).toBe('Unknown Kling API error')
    expect(getKlingErrorMessage(null)).toBe('Unknown Kling API error')
  })
})

// ── provider availability ─────────────────────────────────────────────────────

describe('blockProvider / isProviderAvailable', () => {
  beforeEach(() => {
    // Unblock kling before each test (reset internal state)
    // We call isProviderAvailable which cleans up expired blocks
    isProviderAvailable('kling')
  })

  it('kling is available by default', () => {
    expect(isProviderAvailable('kling')).toBe(true)
  })

  it('blocking kling makes it unavailable', () => {
    blockProvider('kling', 60_000) // 60s
    expect(isProviderAvailable('kling')).toBe(false)
  })

  it('expired block is automatically cleared', () => {
    blockProvider('kling', -1) // already expired
    expect(isProviderAvailable('kling')).toBe(true)
  })
})

// ── getActiveProvider ─────────────────────────────────────────────────────────

describe('getActiveProvider', () => {
  it('returns kling when available', () => {
    // Ensure kling is unblocked
    isProviderAvailable('kling')
    expect(getActiveProvider()).toBe('kling')
  })

  it('still returns kling even when blocked (Seedance not yet available)', () => {
    blockProvider('kling', 60_000)
    // Seedance not yet implemented, so getActiveProvider falls back to kling
    expect(getActiveProvider()).toBe('kling')
    // Cleanup
    blockProvider('kling', -1)
  })
})

// ── classifyKlingResponse ─────────────────────────────────────────────────────

describe('classifyKlingResponse', () => {
  it('returns taskId on success', () => {
    const resp = { code: 0, data: { task_id: 'abc123' } }
    const result = classifyKlingResponse(resp)
    expect(result.taskId).toBe('abc123')
    expect(result.error).toBeUndefined()
    expect(result.quotaExhausted).toBeUndefined()
  })

  it('returns error and quotaExhausted for quota error', () => {
    const resp = { code: 1600039, message: 'Insufficient balance', data: null }
    const result = classifyKlingResponse(resp)
    expect(result.taskId).toBeNull()
    expect(result.quotaExhausted).toBe(true)
    expect(result.error).toContain('Insufficient balance')
  })

  it('returns error (no quotaExhausted) for other API errors', () => {
    const resp = { code: 1500001, message: 'Invalid param', data: null }
    const result = classifyKlingResponse(resp)
    expect(result.taskId).toBeNull()
    expect(result.error).toBe('Invalid param')
    expect(result.quotaExhausted).toBeUndefined()
  })

  it('returns error when data.task_id is missing from a 200 response', () => {
    const resp = { code: 0, data: {} }
    const result = classifyKlingResponse(resp)
    expect(result.taskId).toBeNull()
    expect(result.error).toMatch(/no task_id/i)
  })

  it('returns error for null response', () => {
    const result = classifyKlingResponse(null)
    expect(result.taskId).toBeNull()
    expect(result.error).toBeDefined()
  })
})
