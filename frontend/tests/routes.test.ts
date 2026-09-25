import assert from 'node:assert/strict'
import test from 'node:test'
import { isAdminRoute } from '../src/app/routes.ts'

test('routes only admin paths to the internal application', () => {
  assert.equal(isAdminRoute('/admin'), true)
  assert.equal(isAdminRoute('/admin/accounts'), true)
  assert.equal(isAdminRoute('/'), false)
  assert.equal(isAdminRoute('/administrator'), false)
})
