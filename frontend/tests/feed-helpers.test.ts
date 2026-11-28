import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildResolveReportPayload,
  buildReviewDecisionPayload,
  unwrapFeedReports,
} from '../src/features/admin/components/feed/feed-helpers.ts'

test('unwrapFeedReports handles double-wrapped TransformInterceptor envelope and direct arrays', () => {
  const sample = [{ id: 'report-1' }, { id: 'report-2' }]

  assert.deepEqual(unwrapFeedReports({ data: { data: sample } }), sample)
  assert.deepEqual(unwrapFeedReports({ data: sample }), sample)
  assert.deepEqual(unwrapFeedReports({ data: { other: true } }), [])
  assert.deepEqual(unwrapFeedReports(null), [])
})

test('buildReviewDecisionPayload builds clean payloads for approve, restrict, and reject flows', () => {
  assert.deepEqual(
    buildReviewDecisionPayload({
      revisionNumber: 2,
      decision: 'APPROVED',
      eligible: true,
      blockMedia: true,
      policyCode: 'SPAM',
      note: '   should be omitted   ',
    }),
    {
      revisionNumber: 2,
      decision: 'APPROVED',
      eligible: true,
      blockMedia: false,
    },
  )

  assert.deepEqual(
    buildReviewDecisionPayload({
      revisionNumber: 3,
      decision: 'APPROVED',
      eligible: false,
      policyCode: 'LOW_QUALITY',
      note: '  Ảnh mờ, hạn chế đề xuất  ',
    }),
    {
      revisionNumber: 3,
      decision: 'APPROVED',
      eligible: false,
      blockMedia: false,
      policyCode: 'LOW_QUALITY',
      note: 'Ảnh mờ, hạn chế đề xuất',
    },
  )

  assert.deepEqual(
    buildReviewDecisionPayload({
      revisionNumber: 4,
      decision: 'REJECTED',
      eligible: true,
      blockMedia: true,
      policyCode: 'PROHIBITED_CONTENT',
      note: ' Nội dung vi phạm chính sách ',
    }),
    {
      revisionNumber: 4,
      decision: 'REJECTED',
      eligible: false,
      blockMedia: true,
      policyCode: 'PROHIBITED_CONTENT',
      note: 'Nội dung vi phạm chính sách',
    },
  )
})

test('buildResolveReportPayload includes note only when >= 5 trimmed chars', () => {
  assert.deepEqual(
    buildResolveReportPayload({
      resolution: 'CONTENT_REMOVED',
      policyCode: 'SPAM',
      note: 'abc',
    }),
    {
      resolution: 'CONTENT_REMOVED',
      policyCode: 'SPAM',
    },
  )

  assert.deepEqual(
    buildResolveReportPayload({
      resolution: 'CONTENT_RESTRICTED',
      policyCode: 'OFF_TOPIC',
      note: '  Lệch chủ đề làm đẹp  ',
    }),
    {
      resolution: 'CONTENT_RESTRICTED',
      policyCode: 'OFF_TOPIC',
      note: 'Lệch chủ đề làm đẹp',
    },
  )
})
