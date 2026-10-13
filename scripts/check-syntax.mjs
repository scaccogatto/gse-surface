// Parses every extension module as an ES module (the root package.json sets
// "type": "module", so this does not depend on Node's module detection).
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';

const EXT_DIR = new URL('../surface-control@scaccogatto.github.com/', import.meta.url).pathname;

const files = readdirSync(EXT_DIR).filter(f => f.endsWith('.js')).map(f => join(EXT_DIR, f));
const failed = files.filter(file => spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'}).status !== 0);

if (files.length === 0 || failed.length > 0) {
    console.error(files.length === 0 ? 'No extension modules found' : `Syntax errors in: ${failed.join(', ')}`);
    process.exit(1);
}
console.log(`Syntax OK: ${files.length} modules`);
