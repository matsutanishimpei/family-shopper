import { describe, it, expect } from 'vitest'
import { renderer } from './renderer'

describe('Renderer', () => {
  it('should be a function', () => {
    expect(typeof renderer).toBe('function')
  })
})
