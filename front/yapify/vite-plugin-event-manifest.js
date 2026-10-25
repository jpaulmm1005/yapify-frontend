import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const VIRTUAL_ID = 'virtual:yapi-emitted-events';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Folders inside a package that can hold component source. */
const SCANNED_SUBPATHS = ['src', 'index.js'];

/** Directory names never worth walking into. */
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'demo', 'coverage']);

/** `static get is() { return 'tag'; }` — one per component class. */
const IS_GETTER = /class\s+(\w+)[\s\S]{0,400}?static\s+get\s+is\s*\(\s*\)\s*\{\s*return\s*['"]([a-z][a-z0-9-]*)['"]/g;

/** `_dispatchCustomEvent('literal-name'` / `new CustomEvent('literal-name'`. */
const LITERAL_DISPATCH = /(?:_dispatchCustomEvent|new\s+CustomEvent)\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9-]*)['"]/g;

/** ``_dispatchCustomEvent(`${SomeClass.is}-suffix`` — the tag is resolved later. */
const TEMPLATE_DISPATCH = /(?:_dispatchCustomEvent|new\s+CustomEvent)\s*\(\s*`\$\{\s*(\w+)\.is\s*\}([a-zA-Z0-9-]*)`/g;

/** `@fires {detail} some-event` / `@event some-event` JSDoc tags. */
const JSDOC_EVENT = /@(?:fires|event)\s+(?:\{[^}]*\}\s+)?([a-zA-Z][a-zA-Z0-9-]*)/g;

/**
 * Collects every `.js` file under a package root worth scanning.
 *
 * @param {String} root - Absolute path of the package folder.
 * @returns {String[]} Absolute file paths.
 */
function collectFiles(root) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name));
      } else if (entry.name.endsWith('.js')) {
        files.push(join(dir, entry.name));
      }
    }
  };
  for (const sub of SCANNED_SUBPATHS) {
    const target = join(root, sub);
    if (!existsSync(target)) continue;
    if (statSync(target).isDirectory()) walk(target);
    else files.push(target);
  }
  return files;
}

/**
 * Reads every source file once and extracts the three raw signals the
 * manifest is built from: the class-name → custom-element-tag map, the
 * literal event names, and the `${Class.is}-suffix` template pairs.
 *
 * @param {String[]} files - Absolute file paths.
 * @returns {{ tagOfClass: Map<String, String>, literals: Set<String>, templates: Array<[String, String]> }}
 */
function extractSignals(files) {
  const tagOfClass = new Map();
  const literals = new Set();
  const templates = [];

  for (const file of files) {
    let source;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const [, className, tag] of source.matchAll(IS_GETTER)) {
      tagOfClass.set(className, tag);
    }
    for (const [, name] of source.matchAll(LITERAL_DISPATCH)) literals.add(name);
    for (const [, name] of source.matchAll(JSDOC_EVENT)) literals.add(name);
    for (const [, className, suffix] of source.matchAll(TEMPLATE_DISPATCH)) {
      templates.push([className, suffix]);
    }
  }

  return { tagOfClass, literals, templates };
}

/**
 * Discovers every Yapify package folder whose components can emit events —
 * the sibling checkouts used in dev plus whatever landed in `node_modules`.
 *
 * @param {String} shellRoot - Absolute path of the shell package.
 * @returns {String[]} Absolute package folder paths, deduplicated.
 */
function discoverPackageRoots(shellRoot) {
  const roots = new Set();
  const isYapifyPkg = (name) =>
    name.startsWith('yapify-feature-') ||
    name.startsWith('local-') ||
    name === 'yapify-components' ||
    name === 'yapify-widget-defaults-mixin';

  const siblings = resolve(shellRoot, '..');
  try {
    for (const entry of readdirSync(siblings, { withFileTypes: true })) {
      if (entry.isDirectory() && isYapifyPkg(entry.name)) roots.add(join(siblings, entry.name));
    }
  } catch {
    // noop — CI checkouts have no sibling folders; node_modules covers it.
  }

  const modules = resolve(shellRoot, 'node_modules');
  try {
    for (const entry of readdirSync(modules, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (isYapifyPkg(entry.name)) roots.add(join(modules, entry.name));
    }
    const scoped = join(modules, '@local-yapify-dms');
    if (existsSync(scoped)) {
      for (const entry of readdirSync(scoped, { withFileTypes: true })) {
        if (entry.isDirectory()) roots.add(join(scoped, entry.name));
      }
    }
  } catch {
    // noop — a shell without node_modules cannot run anyway.
  }

  return [...roots];
}

/**
 * Builds the sorted list of every DOM event name a Yapify component is known
 * to emit, by static analysis of the installed packages.
 *
 * @param {String} shellRoot - Absolute path of the shell package.
 * @returns {String[]} Event names, sorted.
 */
export function buildEmittedEventManifest(shellRoot) {
  const files = discoverPackageRoots(shellRoot).flatMap(collectFiles);
  const { tagOfClass, literals, templates } = extractSignals(files);

  const names = new Set(literals);
  for (const [className, suffix] of templates) {
    const tag = tagOfClass.get(className);
    if (tag) names.add(`${tag}${suffix}`);
  }

  return [...names].sort();
}

/**
 * Vite plugin exposing `virtual:yapi-emitted-events` — the manifest the
 * dev-only wiring guard checks every `out:` `bind:` against.
 *
 * `@fires` JSDoc is the contract each component documents, but it is a
 * comment: nothing survives to runtime, and no component exposes a
 * `static get events()`. So the manifest is computed from source at
 * dev-server start (and rebuilt whenever a package file changes), which
 * keeps it exact without asking 60+ feature repos to change.
 *
 * On `build` the module resolves to an empty list: the guard is gated on
 * `import.meta.env.DEV`, and this keeps the production bundle free of it
 * while still resolving the import.
 *
 * @returns {import('vite').Plugin}
 */
export function eventManifestPlugin() {
  let isDev = false;
  let shellRoot = process.cwd();
  let cached = null;

  return {
    name: 'yapi-event-manifest',
    configResolved(config) {
      isDev = config.command === 'serve';
      shellRoot = config.root;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      if (!isDev) return 'export default [];';
      if (!cached) cached = buildEmittedEventManifest(shellRoot);
      return `export default ${JSON.stringify(cached)};`;
    },
    configureServer(server) {
      const invalidate = () => {
        cached = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('change', invalidate);
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);
    },
  };
}
