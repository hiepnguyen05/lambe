import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generateCatalogCode,
  generateCatalogSlug,
  buildIconValue,
  parseIconValue,
  commonCatalogIcons,
} from '../src/features/admin/utils/catalog-form.ts'

test('generates stable catalog slugs from Vietnamese names', () => {
  assert.equal(generateCatalogSlug('  Cắt tóc Nam - Cao cấp  '), 'cat-toc-nam-cao-cap')
})

test('generates uppercase catalog codes with the API length limit', () => {
  assert.equal(generateCatalogCode('Gội đầu dưỡng sinh'), 'GOI_DAU_DUONG_SINH')
  assert.equal(generateCatalogCode('a'.repeat(80)).length, 50)
})

test('normalizes icon names to snake_case for backend Material Symbol validation', () => {
  assert.equal(buildIconValue('layout-grid', ''), 'layout_grid')
  assert.equal(buildIconValue('flower-2', ''), 'flower_2')
  assert.equal(buildIconValue('wand-2', ''), 'wand_2')
  assert.equal(buildIconValue('shield-check', ''), 'shield_check')

  // Verify all common icons strictly match backend regex /^[a-z][a-z0-9_]{0,99}$/
  const backendIconRegex = /^[a-z][a-z0-9_]{0,99}$/
  for (const icon of commonCatalogIcons) {
    assert.match(icon.name, backendIconRegex)
  }

  // Parses legacy kebab-case back into snake_case
  assert.equal(parseIconValue('layout-grid').iconCode, 'layout_grid')
})
