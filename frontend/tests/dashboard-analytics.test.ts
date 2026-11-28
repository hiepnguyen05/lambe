import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OPERATIONAL_ALERT_LABELS,
  emptyDashboardAnalytics,
  getAlertMeta,
} from '../src/features/admin/utils/operational-alerts.ts'

test('operational alert labels cover all backend operational alert types', () => {
  const expectedTypes = [
    'ACCEPTED_START_OVERDUE',
    'EN_ROUTE_OVERDUE',
    'ARRIVAL_START_OVERDUE',
    'SERVICE_COMPLETION_OVERDUE',
    'CANCELLATION_REVIEW_STALE',
    'SAFETY_HOLD_STALE',
    'PAYMENT_DISPUTE_STALE',
    'DISPUTED_STALE',
  ]

  for (const type of expectedTypes) {
    assert.ok(OPERATIONAL_ALERT_LABELS[type], `Missing label for ${type}`)
    assert.equal(getAlertMeta(type).title, OPERATIONAL_ALERT_LABELS[type])
  }
  assert.equal(getAlertMeta('SAFETY_HOLD_STALE').severity, 'urgent')
  assert.equal(getAlertMeta('SERVICE_COMPLETION_OVERDUE').severity, 'warning')
})

test('emptyDashboardAnalytics starts at zero without fabricated trends or categories', () => {
  const empty = emptyDashboardAnalytics('30d')
  assert.equal(empty.period, '30d')
  assert.equal(empty.kpis.gmv, 0)
  assert.equal(empty.kpis.totalBookings, 0)
  assert.equal(empty.kpis.completionRate, 0)
  assert.deepEqual(empty.categoryBreakdown, [])
  assert.deepEqual(empty.growthTrend, [])
})
