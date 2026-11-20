// Writes schema/*.schema.json from the YAML sources.
//   npm run build           regenerate
//   npm run build -- --check  fail if a generated file is out of date (CI)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import yaml from 'js-yaml';

const schemaDir = fileURLToPath(new URL('../schema/', import.meta.url));
const check = process.argv.includes('--check');
let stale = false;

for (const source of readdirSync(schemaDir).filter(name => name.endsWith('.schema.yaml'))) {
	const target = join(schemaDir, source.replace(/\.yaml$/, '.json'));
	const json = `${JSON.stringify(yaml.load(readFileSync(join(schemaDir, source), 'utf8')), null, '\t')}\n`;
	let current = '';
	try {
		current = readFileSync(target, 'utf8');
	} catch {
		// not generated yet
	}
	if (current === json) {
		continue;
	}
	if (check) {
		console.error(`${target} is out of date: run npm run build`);
		stale = true;
	} else {
		writeFileSync(target, json);
		console.log(`Wrote ${target}`);
	}
}

process.exit(stale ? 1 : 0);
