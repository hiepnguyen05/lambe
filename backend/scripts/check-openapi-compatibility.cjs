#!/usr/bin/env node
'use strict';

const { readFileSync, statSync } = require('node:fs');
const METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'head',
  'options',
  'trace',
]);
const ANNOTATIONS = new Set(['description', 'summary', 'example', 'examples']);
const MAPS = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
  'dependentSchemas',
  'dependentRequired',
  'dependencies',
  'content',
  'responses',
  'headers',
  'links',
  'callbacks',
  'encoding',
  'mapping',
  'parameters',
  'scopes',
  'securitySchemes',
]);
const LITERALS = new Set(['default', 'const', 'enum', 'security']);
const LIMIT = 40;
const own = (value, key) => Object.hasOwn(value, key);
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) => JSON.stringify(value);
const name = (value) =>
  value.replace(/[^a-zA-Z0-9_/.{}: -]/g, '_').slice(0, 160);
const invalid = (code) => {
  const error = new Error();
  error.code = code;
  throw error;
};

// Map keys and literal/default/enum values are data, even when named "description".
function normalize(value, refs = new Set(), mode = 'object', depth = 0) {
  if (depth > 128) invalid('document_too_deep');
  if (Array.isArray(value))
    return value.map((entry) =>
      normalize(
        entry,
        refs,
        mode === 'literal' ? 'literal' : 'object',
        depth + 1,
      ),
    );
  if (!object(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .flatMap((key) => {
        if (mode === 'object' && ANNOTATIONS.has(key)) return [];
        if (
          mode === 'object' &&
          ['$dynamicRef', '$recursiveRef', '$id'].includes(key)
        )
          invalid('unsupported_schema_reference');
        if (mode === 'object' && key === '$ref') {
          if (typeof value[key] !== 'string') invalid('invalid_reference');
          pointer(value[key]);
          refs.add(value[key]);
        }
        if (mode === 'object' && key === 'mapping' && object(value[key])) {
          for (const target of Object.values(value[key])) {
            if (typeof target === 'string')
              refs.add(
                target.startsWith('#/')
                  ? target
                  : `#/components/schemas/${target.replaceAll('~', '~0').replaceAll('/', '~1')}`,
              );
          }
        }
        const childMode =
          mode === 'literal' ||
          (mode === 'object' && (LITERALS.has(key) || key.startsWith('x-')))
            ? 'literal'
            : mode === 'object' && MAPS.has(key)
              ? 'map'
              : 'object';
        let entry = normalize(value[key], refs, childMode, depth + 1);
        if (mode === 'object' && key === 'required' && Array.isArray(entry))
          entry = entry.sort((a, b) =>
            canonical(a).localeCompare(canonical(b)),
          );
        return [[key, entry]];
      }),
  );
}

function pointer(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/'))
    invalid('unsupported_reference');
  let parts;
  try {
    parts = decodeURIComponent(ref.slice(2)).split('/');
  } catch {
    invalid('invalid_reference');
  }
  return parts.map((part) => {
    if (/~(?:[^01]|$)/.test(part)) invalid('invalid_reference');
    return part.replaceAll('~1', '/').replaceAll('~0', '~');
  });
}

function lookup(doc, ref) {
  let node = doc;
  for (const part of pointer(ref)) {
    if ((!object(node) && !Array.isArray(node)) || !own(node, part))
      return undefined;
    node = node[part];
  }
  return node;
}

function dereference(doc, value, seen = new Set()) {
  if (!object(value)) invalid('invalid_contract_object');
  if (!own(value, '$ref')) return value;
  if (seen.has(value.$ref)) invalid('cyclic_object_reference');
  seen.add(value.$ref);
  const { $ref, ...siblings } = value;
  return { ...dereference(doc, lookup(doc, $ref), seen), ...siblings };
}

function inventory(doc) {
  if (!object(doc) || !/^3\.[01]\.\d+$/.test(doc.openapi) || !object(doc.paths))
    invalid('invalid_openapi_document');
  if (
    doc.components !== undefined &&
    (!object(doc.components) ||
      ['schemas', 'securitySchemes'].some(
        (key) =>
          doc.components[key] !== undefined && !object(doc.components[key]),
      ))
  )
    invalid('invalid_openapi_document');
  const paths = new Map(),
    operations = new Map();
  for (const [path, raw] of Object.entries(doc.paths)) {
    if (path.startsWith('x-')) continue;
    if (
      !path.startsWith('/') ||
      [...path].some(
        (character) =>
          character.charCodeAt(0) < 32 ||
          character === '?' ||
          character === '#',
      )
    )
      invalid('invalid_path');
    const item = dereference(doc, raw);
    paths.set(path, item);
    for (const method of METHODS)
      if (own(item, method)) {
        if (
          !object(item[method]) ||
          !object(item[method].responses) ||
          !Object.keys(item[method].responses).length
        )
          invalid('invalid_operation');
        operations.set(`${method.toUpperCase()} ${path}`, {
          item,
          operation: item[method],
        });
      }
  }
  if (!operations.size) invalid('empty_operation_inventory');
  return { paths, operations };
}

function parameters(doc, item, operation) {
  const merged = new Map();
  for (const list of [
    item.parameters === undefined ? [] : item.parameters,
    operation.parameters === undefined ? [] : operation.parameters,
  ]) {
    if (!Array.isArray(list)) invalid('invalid_parameters');
    const seen = new Set();
    for (const raw of list) {
      const parameter = dereference(doc, raw);
      if (
        typeof parameter.name !== 'string' ||
        !['path', 'query', 'header', 'cookie'].includes(parameter.in)
      )
        invalid('invalid_parameter');
      const key = canonical([parameter.in, parameter.name]);
      if (seen.has(key)) invalid('duplicate_parameter');
      seen.add(key);
      merged.set(key, parameter);
    }
  }
  return [...merged]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

function contract(doc, { item, operation }, responseCodes) {
  if (own(operation, 'requestBody') && !object(operation.requestBody))
    invalid('invalid_contract_object');
  for (const code of responseCodes)
    if (own(operation.responses, code) && !object(operation.responses[code]))
      invalid('invalid_contract_object');
  const security = own(operation, 'security')
    ? operation.security
    : own(doc, 'security')
      ? doc.security
      : [];
  if (!Array.isArray(security)) invalid('invalid_security');
  const schemes = new Map();
  const requirements = security
    .map((requirement) => {
      if (!object(requirement)) invalid('invalid_security');
      return Object.fromEntries(
        Object.keys(requirement)
          .sort()
          .map((key) => {
            const scopes = requirement[key],
              definition = doc.components?.securitySchemes?.[key];
            if (
              !Array.isArray(scopes) ||
              scopes.some((scope) => typeof scope !== 'string') ||
              !object(definition)
            )
              invalid('invalid_security');
            schemes.set(key, definition);
            return [key, [...new Set(scopes)].sort()];
          }),
      );
    })
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return {
    parameters: parameters(doc, item, operation),
    requestBody: operation.requestBody ?? null,
    security: requirements,
    securitySchemes: Object.fromEntries(
      [...schemes].sort(([a], [b]) => a.localeCompare(b)),
    ),
    responses: Object.fromEntries(
      responseCodes
        .filter((code) => own(operation.responses, code))
        .map((code) => [code, operation.responses[code]]),
    ),
  };
}

function references(doc, seeds) {
  const found = new Map(),
    queue = [...seeds];
  for (let i = 0; i < queue.length; i++) {
    const ref = queue[i];
    if (found.has(ref)) continue;
    if (found.size >= 4096) invalid('too_many_references');
    const value = lookup(doc, ref);
    if (value === undefined) invalid('unresolved_reference');
    const children = new Set(),
      normalized = normalize(value, children);
    found.set(ref, canonical(normalized));
    queue.push(...children);
    // A reference to a schema's subfield still protects the entire existing schema.
    const parts = pointer(ref);
    if (parts[0] === 'components' && parts[1] === 'schemas' && parts.length > 3)
      queue.push(
        `#/components/schemas/${parts[2].replaceAll('~', '~0').replaceAll('/', '~1')}`,
      );
  }
  return found;
}

function compare(before, after) {
  const old = inventory(before),
    next = inventory(after);
  const missingPaths = [...old.paths.keys()].filter(
    (path) => !next.paths.has(path),
  );
  const missingOperations = [],
    changedOperations = [],
    protectedSchemas = new Map();
  for (const [operationName, prior] of old.operations) {
    const refs = new Set();
    const previous = normalize(
      contract(before, prior, Object.keys(prior.operation.responses)),
      refs,
    );
    const reachable = references(before, refs);
    for (const ref of reachable.keys()) {
      const parts = pointer(ref);
      if (
        parts[0] === 'components' &&
        parts[1] === 'schemas' &&
        parts.length === 3
      )
        protectedSchemas.set(parts[2], lookup(before, ref));
    }
    if (!next.operations.has(operationName)) {
      missingOperations.push(name(operationName));
      continue;
    }
    const current = normalize(
      contract(
        after,
        next.operations.get(operationName),
        Object.keys(prior.operation.responses),
      ),
    );
    const fields = [
      'parameters',
      'requestBody',
      'security',
      'securitySchemes',
      'responses',
    ].filter(
      (field) => canonical(previous[field]) !== canonical(current[field]),
    );
    if (
      [...reachable].some(([ref, value]) => {
        const parts = pointer(ref);
        return (
          !(parts[0] === 'components' && parts[1] === 'schemas') &&
          value !== canonical(normalize(lookup(after, ref)))
        );
      })
    )
      fields.push('referencedContracts');
    if (fields.length)
      changedOperations.push({ operation: name(operationName), fields });
  }
  const missingSchemas = [],
    changedSchemas = [];
  for (const [schemaName, schema] of protectedSchemas) {
    if (!own(after.components?.schemas ?? {}, schemaName))
      missingSchemas.push(name(schemaName));
    else if (
      canonical(normalize(schema)) !==
      canonical(normalize(after.components.schemas[schemaName]))
    )
      changedSchemas.push(name(schemaName));
  }
  const versionChanged = before.openapi !== after.openapi;
  const groups = {
    missingPaths: missingPaths.map(name),
    missingOperations,
    changedOperations,
    missingSchemas,
    changedSchemas,
  };
  const counts = Object.fromEntries(
    Object.entries(groups).map(([key, values]) => [key, values.length]),
  );
  const changed = versionChanged || Object.values(counts).some(Boolean);
  return {
    status: changed ? 'review_required' : 'compatible',
    interpretation:
      'Conservative contract comparison; human review required for changes, not a semantic compatibility proof.',
    inventory: {
      before: {
        paths: old.paths.size,
        operations: old.operations.size,
        schemas: Object.keys(before.components?.schemas ?? {}).length,
      },
      after: {
        paths: next.paths.size,
        operations: next.operations.size,
        schemas: Object.keys(after.components?.schemas ?? {}).length,
      },
      addedOperations: [...next.operations.keys()].filter(
        (key) => !old.operations.has(key),
      ).length,
      protectedSchemas: protectedSchemas.size,
    },
    openapiVersionChanged: versionChanged,
    counts,
    names: Object.fromEntries(
      Object.entries(groups).map(([key, values]) => [
        key,
        values.slice(0, LIMIT),
      ]),
    ),
    namesLimitPerGroup: LIMIT,
    nameLengthLimit: 160,
    truncated: Object.values(counts).some((count) => count > LIMIT),
  };
}

function read(file) {
  let text;
  try {
    if (!statSync(file).isFile() || statSync(file).size > 16 * 1024 * 1024)
      invalid('invalid_file');
    text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    invalid('unreadable_or_oversize_file');
  }
  try {
    return JSON.parse(text);
  } catch {
    invalid('invalid_json');
  }
}

function selfTest() {
  const assert = require('node:assert/strict');
  const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join, resolve, relative, isAbsolute } = require('node:path');
  const { spawnSync } = require('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'lambe-openapi-'));
  let checks = 0;
  try {
    const schema = {
      type: 'object',
      properties: {
        description: { type: 'string' },
        example: { type: 'integer' },
        child: { $ref: '#/components/schemas/Child' },
        recursive: { $ref: '#/components/schemas/Data' },
      },
      required: ['description', 'child'],
      default: { description: 'synthetic-default' },
    };
    const base = {
      openapi: '3.0.0',
      security: [{ bearer: [] }],
      components: {
        schemas: {
          Data: schema,
          Child: { type: 'string', enum: ['a', 'b'] },
          DefaultOnly: { type: 'number' },
          Unused: { type: 'string' },
        },
        securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
        responses: {
          Result: {
            description: 'ok',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Data' },
              },
            },
          },
        },
      },
      paths: {
        '/items': {
          parameters: [
            { in: 'query', name: 'limit', schema: { type: 'integer' } },
            { in: 'query', name: 'view', schema: { type: 'string' } },
          ],
          get: {
            responses: {
              200: { $ref: '#/components/responses/Result' },
              default: {
                description: 'fallback',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/DefaultOnly' },
                  },
                },
              },
            },
          },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Data' },
                },
              },
            },
            responses: { 201: { description: 'created' } },
          },
        },
      },
    };
    const beforeFile = join(dir, 'before.json'),
      afterFile = join(dir, 'after.json');
    writeFileSync(beforeFile, JSON.stringify(base));
    const run = (args) => {
      const result = spawnSync(process.execPath, [__filename, ...args], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 65536,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.stderr, '');
      assert(
        !/synthetic-default|secret-auth-value|private-payload/.test(
          result.stdout,
        ),
      );
      return { code: result.status, report: JSON.parse(result.stdout) };
    };
    const check = (mutate, expected, verify = () => {}) => {
      const after = structuredClone(base);
      mutate(after);
      writeFileSync(afterFile, JSON.stringify(after));
      const result = run([beforeFile, afterFile]);
      assert.equal(result.code, expected);
      verify(result.report);
      checks++;
    };
    check(() => {}, 0);
    check((d) => {
      d.paths['/new'] = { get: { responses: { 200: { description: 'ok' } } } };
      d.components.schemas.New = { type: 'boolean' };
      d.components.schemas.Unused.type = 'number';
      d.paths['/items'].get.responses[202] = { description: 'added' };
    }, 0);
    check((d) => {
      d.components.schemas.Data.description = 'private-payload';
      d.components.schemas.Data.required.reverse();
      d.paths['/items'].get.summary = 'private-payload';
      d.paths['/items'].parameters.reverse();
      d.paths['/items'].get.responses.default.description = 'private-payload';
      d.paths['/items'].get.responses[200].examples = {
        private: 'private-payload',
      };
    }, 0);
    check(
      (d) => {
        delete d.paths['/items'].get;
      },
      1,
      (r) => assert.equal(r.counts.missingOperations, 1),
    );
    check(
      (d) => {
        d.paths['/new'] = { get: { responses: { 200: {} } } };
        d.paths['/items'].parameters[0].required = true;
      },
      1,
      (r) => assert.equal(r.counts.changedOperations, 2),
    );
    check((d) => {
      d.paths['/items'].post.requestBody.required = true;
    }, 1);
    check((d) => {
      delete d.paths['/items'].get.responses[200];
      d.paths['/items'].get.responses[204] = {};
    }, 1);
    check(
      (d) => {
        d.components.schemas.Child.enum.pop();
      },
      1,
      (r) => assert.deepEqual(r.names.changedSchemas, ['Child']),
    );
    check((d) => {
      d.components.schemas.Data.properties.description.type = 'integer';
    }, 1);
    check((d) => {
      d.components.schemas.Data.properties.example.type = 'string';
    }, 1);
    check((d) => {
      d.components.schemas.DefaultOnly.type = 'string';
    }, 1);
    check(
      (d) => {
        delete d.paths['/items'];
        d.paths['/replacement'] = {
          get: { responses: { 200: { description: 'ok' } } },
        };
      },
      1,
      (r) => {
        assert.equal(r.counts.missingPaths, 1);
        assert.equal(r.counts.missingOperations, 2);
      },
    );
    check((d) => {
      d.components.schemas.Data.default.description = 'private-payload';
    }, 1);
    check((d) => {
      d.paths['/items'].get.security = [];
    }, 1);
    check((d) => {
      d.components.securitySchemes.bearer.scheme = 'secret-auth-value';
    }, 1);
    check((d) => {
      d.components.responses.Result.headers = {
        version: { schema: { type: 'string' } },
      };
    }, 1);
    check((d) => {
      delete d.components.schemas.Data;
    }, 1);
    check((d) => {
      d.components.schemas.Child = {
        type: 'object',
        properties: { recursive: { $ref: '#/components/schemas/Child' } },
      };
    }, 1);
    check((d) => {
      d.paths['/items'].post.requestBody.$ref =
        'https://example.invalid/schema';
    }, 2);
    for (const args of [
      [],
      [beforeFile],
      [beforeFile, join(dir, 'missing.json')],
    ]) {
      assert.equal(run(args).code, 2);
      checks++;
    }
    writeFileSync(afterFile, '{private-payload');
    assert.equal(run([beforeFile, afterFile]).code, 2);
    checks++;
    return { status: 'passed', cliChecks: checks, networkRequests: 0 };
  } catch {
    return {
      status: 'failed',
      cliChecks: checks,
      failedCheck: checks + 1,
      detailsSuppressed: true,
    };
  } finally {
    const child = relative(resolve(tmpdir()), resolve(dir));
    if (!child || child.startsWith('..') || isAbsolute(child))
      invalid('unsafe_temp_cleanup');
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(args) {
  try {
    if (args.length === 1 && args[0] === '--self-test') {
      const report = selfTest();
      process.exitCode = report.status === 'passed' ? 0 : 2;
      return report;
    }
    if (args.length !== 2) invalid('usage_BEFORE_JSON_AFTER_JSON');
    const report = compare(read(args[0]), read(args[1]));
    process.exitCode = report.status === 'compatible' ? 0 : 1;
    return report;
  } catch (error) {
    process.exitCode = 2;
    const codes = new Set([
      'usage_BEFORE_JSON_AFTER_JSON',
      'unreadable_or_oversize_file',
      'invalid_json',
      'invalid_openapi_document',
      'invalid_path',
      'invalid_operation',
      'empty_operation_inventory',
      'invalid_parameters',
      'invalid_parameter',
      'duplicate_parameter',
      'invalid_security',
      'unsupported_reference',
      'unsupported_schema_reference',
      'invalid_reference',
      'unresolved_reference',
      'cyclic_object_reference',
      'invalid_contract_object',
      'too_many_references',
      'document_too_deep',
    ]);
    return {
      status: 'invalid_input',
      error: codes.has(error?.code) ? error.code : 'validation_failed',
      detailsSuppressed: true,
    };
  }
}

module.exports = { compare };
if (require.main === module)
  process.stdout.write(JSON.stringify(main(process.argv.slice(2))) + '\n');
