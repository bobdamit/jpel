#!/usr/bin/env node
// Verifies that the generated schema (from build:schema) matches the
// checked-in design/schema.json and that it compiles with Ajv.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

function loadJson(p) {
  if (!fs.existsSync(p)) {
    console.error('Missing file:', p);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedPath = path.join(repoRoot, 'design', 'schema-resolved.json');
const checkedInPath = path.join(repoRoot, 'design', 'schema.json');

if (!fs.existsSync(generatedPath)) {
  console.error('Generated schema not found. Run `npm run build:schema` first.');
  process.exit(2);
}

const gen = loadJson(generatedPath);
const checked = loadJson(checkedInPath);

// Deep compare
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

if (!deepEqual(gen, checked)) {
  console.error('ERROR: generated schema differs from checked-in design/schema.json');
  // Show a short diagnostic
  console.error('Generated size:', JSON.stringify(gen).length, 'Committed size:', JSON.stringify(checked).length);
  process.exit(1);
}

// Validate with Ajv
const ajv = new Ajv({ allErrors: true, strict: true });
try {
  ajv.compile(checked);
} catch (err) {
  console.error('Ajv compilation failed for design/schema.json:', err && err.message ? err.message : err);
  process.exit(1);
}

console.log('Schema verification passed: design/schema.json matches generated schema and compiles with Ajv');
process.exit(0);
