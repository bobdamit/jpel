Schema bundling
----------------

This project includes a small utility to produce a dereferenced JSON Schema
artifact from the canonical `design/schema.yaml` OpenAPI-style document.

Usage:

- Install dev dependencies: `npm install`
- Build resolved JSON Schema: `npm run build:schema`

This writes `design/schema-resolved.json` which will be preferred by the
runtime `ProcessNormalizer`. Producing the resolved schema in CI ensures that
Ajv validation is deterministic and avoids runtime $ref rewriting.
