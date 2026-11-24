import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessFeature } from '../src/features/admin/auth/admin-permissions.ts'

test('admin-only catalog and internal administration stay restricted', () => {
  assert.equal(canAccessFeature(['ADMIN'], 'catalog'), true)
  assert.equal(canAccessFeature(['SUPPORT'], 'catalog'), false)
  assert.equal(canAccessFeature(['MODERATOR'], 'internalAdministration'), false)
})

test('operational roles match backend access', () => {
  assert.equal(canAccessFeature(['SUPPORT'], 'orderAlerts'), true)
  assert.equal(canAccessFeature(['MODERATOR'], 'orderAlerts'), false)
  assert.equal(canAccessFeature(['KYC_REVIEWER'], 'memberKyc'), true)
  assert.equal(canAccessFeature(['SERVICE_REVIEWER'], 'serviceChanges'), true)
})
