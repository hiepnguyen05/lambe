import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatInternationalPhone,
  formatNationalPhone,
  normalizeNationalPhoneInput,
  toVietnamesePhone,
  VIETNAMESE_PHONE_PATTERN,
} from '../src/features/auth/utils/phone.ts'

test('normalizes supported Vietnamese phone input formats', () => {
  assert.equal(normalizeNationalPhoneInput('0912 345 678'), '912345678')
  assert.equal(normalizeNationalPhoneInput('+84 912 345 678'), '912345678')
  assert.equal(toVietnamesePhone('912345678'), '0912345678')
})

test('formats phone numbers consistently for the UI', () => {
  assert.equal(formatNationalPhone('912345678'), '912 345 678')
  assert.equal(formatInternationalPhone('0912345678'), '+84 912 345 678')
})

test('produces a phone number accepted by the backend contract', () => {
  assert.equal(VIETNAMESE_PHONE_PATTERN.test(toVietnamesePhone('912345678')), true)
  assert.equal(VIETNAMESE_PHONE_PATTERN.test(toVietnamesePhone('112345678')), false)
})
