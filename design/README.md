# JPEL Schema Files

This directory contains the JSON Schema definitions for JPEL processes and instances.

## File Organization

### Source Files (Edit These)
- `schema-process.yaml` - Process definition schema (validates process templates)
- `schema-instance.yaml` - Runtime instance schema (validates process/activity instances)

### Generated Files (Do Not Edit)
- `schema-process.json` - Generated from schema-process.yaml (used by process loader)
- `schema-instance.json` - Generated from schema-instance.yaml (used for runtime validation)

## Usage

### For Process Validation
The process loader uses `schema-process.json` to validate process definitions during loading.

### For Instance Validation  
Use `schema-instance.json` to validate process instances and activity instances during runtime.

### Building Schemas
Run `npm run build:schema` from the runner-node directory to regenerate all JSON files from YAML sources.

## Schema Purpose

- **Process Schema**: Validates process templates/definitions before execution
- **Instance Schema**: Validates runtime process and activity instances during execution

## Modification Workflow

1. Edit YAML source files (`schema-process.yaml`, `schema-instance.yaml`)
2. Run `npm run build:schema` to regenerate JSON files
3. Test with `npm test` to ensure schema changes don't break validation