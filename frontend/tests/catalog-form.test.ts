import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCatalogCode, generateCatalogSlug } from '../src/features/admin/utils/catalog-form.ts'

test('generates stable catalog slugs from Vietnamese names', () => {
  assert.equal(generateCatalogSlug('  Cắt tóc Nam - Cao cấp  '), 'cat-toc-nam-cao-cap')
})

test('generates uppercase catalog codes with the API length limit', () => {
  assert.equal(generateCatalogCode('Gội đầu dưỡng sinh'), 'GOI_DAU_DUONG_SINH')
  assert.equal(generateCatalogCode('a'.repeat(80)).length, 50)
})
