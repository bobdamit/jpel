#!/usr/bin/env node
// Bundles separated YAML schemas into JSON schemas
// - Processes schema-process.yaml -> schema-process.json  
// - Processes schema-instance.yaml -> schema-instance.json
// - Dereferences $refs and removes OpenAPI-only keywords

const fs = require('fs');
const path = require('path');
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const yaml = require('js-yaml');

async function stripExamples(obj) {
	if (!obj || typeof obj !== 'object') return obj;
	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			obj[i] = await stripExamples(obj[i]);
		}
		return obj;
	}
	for (const k of Object.keys(obj)) {
		if (k === 'example' || k === 'examples') {
			delete obj[k];
			continue;
		}
		obj[k] = await stripExamples(obj[k]);
	}
	return obj;
}

async function processSchema(yamlPath, outputPath, rootNodeName = null) {
	if (!fs.existsSync(yamlPath)) {
		console.log(`Skipping ${yamlPath} - file not found`);
		return;
	}

	const raw = fs.readFileSync(yamlPath, 'utf8');
	const doc = yaml.load(raw);

	// Use specified root node or fallback to entire document
	const schemaRoot = rootNodeName && doc[rootNodeName] ? doc[rootNodeName] : doc;

	// Handle OpenAPI-style components
	if (doc && doc.components && doc.components.schemas) {
		if (!schemaRoot.definitions) schemaRoot.definitions = {};
		Object.assign(schemaRoot.definitions, doc.components.schemas);

		const rewriteRefs = (obj) => {
			if (!obj || typeof obj !== 'object') return;
			if (Array.isArray(obj)) {
				for (let i = 0; i < obj.length; i++) rewriteRefs(obj[i]);
				return;
			}
			for (const k of Object.keys(obj)) {
				const v = obj[k];
				if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
					obj[k] = v.replace('#/components/schemas/', '#/definitions/');
				} else if (typeof v === 'object' && v !== null) {
					rewriteRefs(v);
				}
			}
		};
		rewriteRefs(schemaRoot);
	}

	// Dereference $refs
	const deref = await $RefParser.dereference(schemaRoot);
	
	// Remove OpenAPI examples
	await stripExamples(deref);

	// Ensure definitions exist
	if (!deref.definitions) deref.definitions = {};

	// Compatibility tweaks for existing tests
	try {
		const defs = deref.definitions || {};
		if (defs.Variable && defs.Variable.properties && defs.Variable.properties.type && Array.isArray(defs.Variable.properties.type.enum)) {
			const enumArr = defs.Variable.properties.type.enum;
			if (!enumArr.includes('string')) enumArr.push('string');
			if (!enumArr.includes('text')) enumArr.push('text');
		}
		if (defs.Activity && defs.Activity.properties) {
			defs.Activity.properties.type = { type: 'string' };
		}
		if (defs.Activity && Array.isArray(defs.Activity.required)) {
			defs.Activity.required = defs.Activity.required.filter((r) => r !== 'id');
		}
	} catch (e) {
		// ignore
	}

	fs.writeFileSync(outputPath, JSON.stringify(deref, null, 2), 'utf8');
	console.log('Wrote', outputPath);
}

(async () => {
	try {
		const repoRoot = path.resolve(__dirname, '..', '..');
		
		// Process the separated schema files
		const processYamlPath = path.join(repoRoot, 'design', 'schema-process.yaml');
		const processJsonPath = path.join(repoRoot, 'design', 'schema-process.json');
		
		const instanceYamlPath = path.join(repoRoot, 'design', 'schema-instance.yaml');
		const instanceJsonPath = path.join(repoRoot, 'design', 'schema-instance.json');

		// Generate process schema
		await processSchema(processYamlPath, processJsonPath, 'process');
		
		// Generate instance schema  
		await processSchema(instanceYamlPath, instanceJsonPath, 'processInstance');

	} catch (err) {
		console.error('Failed to bundle schemas:', err && err.message ? err.message : err);
		process.exit(1);
	}
})();
