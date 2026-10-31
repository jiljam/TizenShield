// Builds dist/userScript.js (injected by TizenBrew into every page) and
// dist/start.html. Output must run on 2017 Samsung TVs (Tizen 3.0, Chrome
// 47), so the bundle is converted to ES5 and then checked with an ES5-only
// parser.
//
//   node build.mjs                                  # production build into dist/
//   node build.mjs --start-url <url> --outdir <dir> # local test build
import { readFile, readdir, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';
import { transformAsync } from '@babel/core';
import { parse } from 'acorn';

// Browser APIs that Chrome 47 lacks. Babel converts syntax, not these.
const UNSUPPORTED_APIS = [
  [/Object\.(entries|values|fromEntries)\b/, 'Object.entries/values (Chrome 54)'],
  [/\bURLSearchParams\b/, 'URLSearchParams (Chrome 49)'],
  [/\bIntersectionObserver\b/, 'IntersectionObserver (Chrome 51)'],
  [/\.attachShadow\b/, 'attachShadow (Chrome 53)'],
  [/\.(append|prepend|replaceWith|before|after)\(/, 'ChildNode/ParentNode helpers (Chrome 54)'],
  [/\.(padStart|padEnd|trimStart|trimEnd|flat|flatMap)\(/, 'ES2017+ methods'],
  [/\.finally\(/, 'Promise.prototype.finally (Chrome 63)'],
  [/\b(async|await)\b/, 'async/await (needs regenerator runtime)'],
  [/function\s*\*/, 'generators (needs regenerator runtime)'],
  [/\.focus\(\{/, 'focus options (Chrome 64)'],
  [/scroll(IntoView|To|By)\(\{/, 'scroll options (Chrome 61)'],
  [/requestIdleCallback/, 'requestIdleCallback (Chrome 47 lacks it)'],
  [/\.forEach\b.*querySelectorAll|querySelectorAll\([^)]*\)\.forEach/, 'NodeList.forEach (Chrome 51); wrap in toArray()']
];

const { values: args } = parseArgs({
  options: {
    'start-url': { type: 'string' },
    outdir: { type: 'string', default: 'dist' }
  }
});

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const startUrl = args['start-url'] || pkg.websiteURL;

async function lint() {
  const problems = [];
  for (const name of await readdir('src')) {
    const lines = (await readFile(join('src', name), 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      for (const [pattern, what] of UNSUPPORTED_APIS) {
        if (pattern.test(line)) problems.push(`src/${name}:${i + 1}: ${what}`);
      }
    });
  }
  if (problems.length) throw new Error('Not available on Chrome 47:\n  ' + problems.join('\n  '));
}

await lint();

const bundle = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  write: false,
  legalComments: 'none',
  define: {
    __START_URL__: JSON.stringify(startUrl),
    __VERSION__: JSON.stringify(pkg.version)
  }
});

const { code } = await transformAsync(bundle.outputFiles[0].text, {
  babelrc: false,
  configFile: false,
  sourceType: 'script',
  presets: [['@babel/preset-env', { targets: 'chrome 47', forceAllTransforms: true, modules: false }]]
});

const output = `/* TizenShield ${pkg.version} */\n${code}\n`;
try {
  parse(output, { ecmaVersion: 5 });
} catch (error) {
  throw new Error(`Build output is not valid ES5 (${error.message}); it would fail on Tizen 3.0 TVs.`);
}

await mkdir(args.outdir, { recursive: true });
await writeFile(join(args.outdir, 'userScript.js'), output);
await copyFile('static/start.html', join(args.outdir, 'start.html'));
console.log(`Built ${args.outdir}/userScript.js (${(output.length / 1024).toFixed(1)} KiB, ES5) with start page ${startUrl}`);
