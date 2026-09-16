// One command that says whether a .bpmn file is correct, readable and portable.
//
// Usage: node scripts/check.mjs <file.bpmn> [--out <dir>] [--page WxH] [--strict-readability]
//
// It runs four steps in order and prints one JSON summary followed by a plain-text verdict.
//   (a) schema    XML validity against the OMG BPMN 2.0 XSD set, through xmllint.
//   (b) lint      bpmnlint with the recommended rule set.
//   (c) structure the file opened by bpmn-js in a headless browser: import warnings, parity between
//                 the model and the diagram, shape overlaps, lane and pool containment, the rule that
//                 a sequence flow stays inside one pool while a message flow crosses pools, and
//                 artefacts left without a connection.
//   (d) readability counts per process level, reported against two published guidelines.
//
// Exit code is 1 when step a, b or c reports anything. Step d is a report; it only changes the exit
// code when --strict-readability is passed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';
import { fetchXsd, XSD_BASE, XSD_FILES } from './fetch-xsd.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);

// Two published guidelines, reported by name so the number in the output can be traced to its source.
const GUIDELINES = {
  activitiesPerLevel: {
    limit: 10,
    source: 'Bruce Silver, BPMN Method and Style, style rule 0005: at most ten activities per process level.'
  },
  elementsPerModel: {
    limit: 50,
    source: 'Seven Process Modeling Guidelines, guideline 7: decompose any model over fifty elements. Mendling, Reijers and van der Aalst, Information and Software Technology 52(2), 2010.'
  }
};

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const args = { file: null, out: 'out', page: { width: 1600, height: 1000 }, strictReadability: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--page') {
      const raw = String(argv[++i] || '');
      const m = raw.match(/^(\d+)\s*[xX]\s*(\d+)$/);
      if (!m) fail(`--page expects a size such as 1600x1000, received "${raw}"`);
      args.page = { width: Number(m[1]), height: Number(m[2]) };
    } else if (a === '--strict-readability') args.strictReadability = true;
    else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
    else if (a.startsWith('--')) fail(`unknown option ${a}`);
    else if (!args.file) args.file = a;
    else fail(`unexpected argument ${a}`);
  }
  if (!args.file) { usage(); process.exit(2); }
  return args;
}
function usage() {
  console.log('Usage: node scripts/check.mjs <file.bpmn> [--out <dir>] [--page WxH] [--strict-readability]');
}
function fail(message) { console.error(`check.mjs: ${message}`); process.exit(2); }

const args = parseArgs(process.argv.slice(2));
if (!fs.existsSync(args.file)) fail(`file not found: ${args.file}`);
const xml = fs.readFileSync(args.file, 'utf8');
const base = path.basename(args.file, '.bpmn');
const resolvedFile = path.resolve(args.file);
// Paths are reported relative to where the command runs, so the output reads the same on every machine.
const shortFile = path.relative(process.cwd(), resolvedFile) || path.basename(resolvedFile);
const findings = [];
const notes = [];

// ---------------------------------------------------------------- (a) XML schema, through xmllint
const schema = { step: 'a', name: 'XML schema (OMG BPMN 2.0 XSD)', status: 'skipped', messages: [] };
const xmllint = spawnSync('xmllint', ['--version'], { encoding: 'utf8' });
if (xmllint.error) {
  schema.status = 'skipped';
  schema.reason = 'xmllint is not installed';
  schema.howToInstall = 'macOS: xmllint ships with the Xcode command line tools, run "xcode-select --install". Debian or Ubuntu: "sudo apt-get install libxml2-utils". Red Hat or Fedora: "sudo dnf install libxml2". Windows: install libxml2 through "choco install xsltproc" or use the Windows Subsystem for Linux.';
} else {
  schema.tool = (xmllint.stderr || xmllint.stdout || '').split('\n')[0].trim();
  try {
    const xsd = await fetchXsd({ log: (m) => notes.push(m) });
    schema.schemaSource = XSD_BASE;
    schema.schemaFiles = XSD_FILES;
    schema.schemaDir = path.relative(ROOT, xsd.dir);
    const run = spawnSync('xmllint', ['--noout', '--schema', xsd.entry, shortFile], { encoding: 'utf8' });
    const out = `${run.stdout || ''}${run.stderr || ''}`.trim();
    schema.messages = out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    schema.status = run.status === 0 ? 'passed' : 'failed';
    if (run.status !== 0) {
      for (const line of schema.messages) if (!/validates$/.test(line)) findings.push({ step: 'a', kind: 'schema', message: line });
      if (!schema.messages.length) findings.push({ step: 'a', kind: 'schema', message: `xmllint exited with code ${run.status}` });
    }
  } catch (err) {
    schema.status = 'skipped';
    schema.reason = `the OMG schema files could not be downloaded: ${err.message}`;
    schema.howToInstall = `Download ${XSD_FILES.join(', ')} from ${XSD_BASE} into ${path.relative(ROOT, path.join(HERE, 'xsd'))} and run the check again.`;
  }
}

// ---------------------------------------------------------------- (b) bpmnlint, recommended rules
const lint = { step: 'b', name: 'bpmnlint (bpmnlint:recommended)', status: 'skipped', findings: [] };
const bpmnlintBin = path.join(ROOT, 'node_modules', '.bin', 'bpmnlint');
if (!fs.existsSync(bpmnlintBin)) {
  lint.reason = 'bpmnlint is not installed, run "npm install" in the bpmn folder';
} else {
  const run = spawnSync(bpmnlintBin, [path.relative(ROOT, resolvedFile) || resolvedFile], { cwd: ROOT, encoding: 'utf8' });
  const out = `${run.stdout || ''}${run.stderr || ''}`.trim();
  // bpmnlint echoes the file it read as an absolute path. Shorten it, so the report is machine neutral.
  const shorten = (l) => l.split(resolvedFile).join(shortFile).split(`${ROOT}/`).join('');
  const lines = out ? out.split('\n').map((l) => shorten(l.trim())).filter(Boolean) : [];
  // The report prints the file name first, one line per rule hit, then a count line. Keep the hits.
  const isCountLine = (l) => /problems?\s*\(/i.test(l) || /^[^\w]*\d+\s+problems?\b/i.test(l);
  lint.findings = lines.filter((l) => /\b(error|warning)\b/i.test(l) && !isCountLine(l));
  lint.status = run.status === 0 ? 'passed' : 'failed';
  lint.raw = lines;
  if (run.status !== 0) {
    const reported = lint.findings.length ? lint.findings : [`bpmnlint exited with code ${run.status}`];
    for (const message of reported) findings.push({ step: 'b', kind: 'lint', message });
  }
}

// ---------------------------------------------------------------- (c) structure, through bpmn-js
// Counts taken from the XML itself. The same elements are counted in the diagram, and the two numbers
// have to agree: a model element without a shape or an edge is invisible to every reader.
const count = (re) => (xml.match(re) || []).length;
const xmlCounts = {
  participants: count(/<(?:bpmn:)?participant\b/g),
  lanes: count(/<(?:bpmn:)?lane\b/g),
  flowNodes: count(/<(?:bpmn:)?(startEvent|endEvent|task|userTask|serviceTask|manualTask|scriptTask|businessRuleTask|sendTask|receiveTask|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|subProcess|callActivity|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent)\b/g),
  sequenceFlows: count(/<(?:bpmn:)?sequenceFlow\b/g),
  messageFlows: count(/<(?:bpmn:)?messageFlow\b/g),
  dataObjectRefs: count(/<(?:bpmn:)?dataObjectReference\b/g),
  dataStoreRefs: count(/<(?:bpmn:)?dataStoreReference\b/g),
  textAnnotations: count(/<(?:bpmn:)?textAnnotation\b/g),
  associations: count(/<(?:bpmn:)?association\b/g),
  dataAssociations: count(/<(?:bpmn:)?data(?:Input|Output)Association\b/g)
};
const xmlExpected = Object.values(xmlCounts).reduce((a, b) => a + b, 0);

const structure = { step: 'c', name: 'bpmn-js import, diagram parity and layout', status: 'skipped' };
const viewerPath = path.join(ROOT, 'node_modules', 'bpmn-js', 'dist', 'bpmn-navigated-viewer.production.min.js');
if (!fs.existsSync(viewerPath)) {
  structure.reason = 'bpmn-js is not installed, run "npm install" in the bpmn folder';
} else {
  const viewerJs = fs.readFileSync(viewerPath, 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'node_modules', 'bpmn-js', 'dist', 'assets', 'bpmn-js.css'), 'utf8');
  const fontCss = fs.readFileSync(path.join(ROOT, 'node_modules', 'bpmn-js', 'dist', 'assets', 'bpmn-font', 'css', 'bpmn-embedded.css'), 'utf8');
  const { width, height } = args.page;
  const html = `<!doctype html><html><head><style>${css}${fontCss}html,body,#c{margin:0;width:${width}px;height:${height}px}</style></head><body><div id="c"></div><script>${viewerJs}</script></body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html);
  const res = await page.evaluate(async ({ xml, width, height }) => {
    const viewer = new BpmnJS({ container: '#c' });
    const { warnings } = await viewer.importXML(xml);
    const registry = viewer.get('elementRegistry');
    const canvas = viewer.get('canvas');
    const all = registry.getAll();
    const isRoot = (e) => e.type === 'bpmn:Collaboration' || e.type === 'bpmn:Process' || e.id === canvas.getRootElement().id;
    const shapes = all.filter((e) => !e.waypoints && e.type !== 'label' && !e.labelTarget);
    const nodes = shapes.filter((e) => !isRoot(e));
    const bb = (e) => ({ x: e.x, y: e.y, w: e.width, h: e.height, x2: e.x + e.width, y2: e.y + e.height });
    const overlaps = (a, b) => a.x < b.x2 && b.x < a.x2 && a.y < b.y2 && b.y < a.y2;
    const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x2 <= outer.x2 && inner.y2 <= outer.y2;
    const issues = [];
    const pools = nodes.filter((e) => e.type === 'bpmn:Participant');
    const lanes = nodes.filter((e) => e.type === 'bpmn:Lane');
    const artefactTypes = ['bpmn:TextAnnotation', 'bpmn:DataObjectReference', 'bpmn:DataStoreReference'];
    const flowNodes = nodes.filter((e) => !['bpmn:Participant', 'bpmn:Lane', ...artefactTypes].includes(e.type));
    const leaves = nodes.filter((e) => !['bpmn:Participant', 'bpmn:Lane'].includes(e.type));

    // No two shapes cover each other. Pools and lanes are excluded: they are meant to contain shapes.
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        if (overlaps(bb(leaves[i]), bb(leaves[j]))) issues.push({ kind: 'overlap', message: `shapes overlap: ${leaves[i].id} and ${leaves[j].id}` });
      }
    }
    // The same test for the labels that sit outside their shape, and for labels against each other.
    const labels = all.filter((e) => e.type === 'label');
    const lb = (e) => ({ x: e.x, y: e.y, x2: e.x + e.width, y2: e.y + e.height });
    for (const label of labels) {
      const owner = label.labelTarget;
      for (const n of leaves) {
        if (n === owner) continue;
        if (owner && owner.waypoints && (owner.source === n || owner.target === n)) continue;
        if (overlaps(lb(label), bb(n))) issues.push({ kind: 'overlap', message: `label of ${owner ? owner.id : 'unknown element'} covers ${n.id}` });
      }
    }
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (overlaps(lb(labels[i]), lb(labels[j]))) {
          const a = labels[i].labelTarget && labels[i].labelTarget.id;
          const b = labels[j].labelTarget && labels[j].labelTarget.id;
          issues.push({ kind: 'overlap', message: `labels overlap: ${a} and ${b}` });
        }
      }
    }
    // Every flow node sits inside the lane that claims it, and inside a pool.
    for (const n of flowNodes) {
      const lane = lanes.find((l) => (l.businessObject.flowNodeRef || []).some((r) => r.id === n.id));
      if (lane && !contains(bb(lane), bb(n))) issues.push({ kind: 'containment', message: `${n.id} is drawn outside its lane ${lane.id}` });
      if (pools.length && !pools.some((p) => contains(bb(p), bb(n)))) issues.push({ kind: 'containment', message: `${n.id} is drawn outside every pool` });
    }
    // A sequence flow stays inside one pool. A message flow always crosses pools.
    const poolOf = (e) => { let p = e; while (p && p.type !== 'bpmn:Participant') p = p.parent; return p ? p.id : null; };
    for (const c of all.filter((e) => e.waypoints)) {
      if (c.type === 'bpmn:SequenceFlow' && poolOf(c.source) !== poolOf(c.target)) issues.push({ kind: 'flow-rule', message: `sequence flow ${c.id} crosses a pool boundary` });
      if (c.type === 'bpmn:MessageFlow' && poolOf(c.source) === poolOf(c.target)) issues.push({ kind: 'flow-rule', message: `message flow ${c.id} stays inside one pool` });
    }
    // An annotation or a data object with no connection is an orphan: it says nothing about the process.
    for (const n of nodes.filter((e) => artefactTypes.includes(e.type))) {
      const connections = (n.incoming || []).length + (n.outgoing || []).length;
      if (!connections) issues.push({ kind: 'orphan', message: `${n.type.replace('bpmn:', '')} ${n.id} has no association` });
    }
    // Does the drawing fit the page budget at zoom 1.
    const inner = canvas.viewbox().inner;
    if (inner.width > width || inner.height > height) {
      issues.push({ kind: 'page-budget', message: `the diagram measures ${Math.round(inner.width)} by ${Math.round(inner.height)} pixels and does not fit the page budget of ${width} by ${height}` });
    }
    canvas.zoom('fit-viewport');
    const { svg } = await viewer.saveSVG();
    return {
      warnings: warnings.map((w) => String(w.message || w)),
      registryElementsNoLabels: all.filter((e) => e.type !== 'label' && !isRoot(e)).length,
      issues,
      inner: { width: Math.round(inner.width), height: Math.round(inner.height) },
      svg
    };
  }, { xml, width, height });

  if (args.out) {
    fs.mkdirSync(args.out, { recursive: true });
    fs.writeFileSync(path.join(args.out, `${base}.svg`), res.svg);
    await page.screenshot({ path: path.join(args.out, `${base}.png`), fullPage: false });
  }
  await browser.close();

  structure.importWarnings = res.warnings;
  structure.diParity = { modelElements: xmlExpected, diagramElements: res.registryElementsNoLabels, equal: res.registryElementsNoLabels === xmlExpected, xmlCounts };
  structure.layoutIssues = res.issues;
  structure.size = res.inner;
  structure.pageBudget = { width, height, note: 'The page budget is a readability limit chosen by this repository, not a rule of the BPMN standard. Change it with --page WxH.' };
  structure.exports = args.out ? [path.join(args.out, `${base}.svg`), path.join(args.out, `${base}.png`)] : [];
  structure.status = res.warnings.length || res.issues.length || !structure.diParity.equal ? 'failed' : 'passed';

  for (const w of res.warnings) findings.push({ step: 'c', kind: 'import-warning', message: w });
  if (!structure.diParity.equal) {
    findings.push({ step: 'c', kind: 'parity', message: `diagram parity failure: the model holds ${xmlExpected} elements and the diagram draws ${res.registryElementsNoLabels}` });
  }
  for (const issue of res.issues) findings.push({ step: 'c', kind: issue.kind, message: issue.message });
}

// ---------------------------------------------------------------- (d) readability count per level
// A level is one process, plus any sub-process drawn open with its own flow nodes inside it.
const ACTIVITY = /<(?:bpmn:)?(task|userTask|serviceTask|manualTask|scriptTask|businessRuleTask|sendTask|receiveTask|subProcess|callActivity|transaction)\b/g;
function activityCount(fragment) { return (fragment.match(ACTIVITY) || []).length; }

const levels = [];
for (const m of xml.matchAll(/<(?:bpmn:)?process\b([^>]*)>([\s\S]*?)<\/(?:bpmn:)?process>/g)) {
  const attrs = m[1];
  let body = m[2];
  const id = (attrs.match(/\bid="([^"]+)"/) || [])[1] || 'process';
  const name = (attrs.match(/\bname="([^"]+)"/) || [])[1] || id;
  // Pull out sub-processes that are drawn open: they are a level of their own.
  for (const sub of body.matchAll(/<(?:bpmn:)?subProcess\b([^>]*)>([\s\S]*?)<\/(?:bpmn:)?subProcess>/g)) {
    const inner = sub[2];
    if (!activityCount(inner)) continue;
    const subId = (sub[1].match(/\bid="([^"]+)"/) || [])[1] || 'subProcess';
    const subName = (sub[1].match(/\bname="([^"]+)"/) || [])[1] || subId;
    levels.push({ level: subName, id: subId, activities: activityCount(inner) });
    body = body.replace(inner, '');
  }
  levels.push({ level: name, id, activities: activityCount(body) });
}
// The element count is the same total the parity check uses: every pool, lane, node, flow and artefact.
const totalElements = xmlExpected;
const readability = {
  step: 'd',
  name: 'readability count',
  mode: args.strictReadability ? 'enforced' : 'report only',
  levels: levels.map((l) => ({ ...l, limit: GUIDELINES.activitiesPerLevel.limit, withinGuideline: l.activities <= GUIDELINES.activitiesPerLevel.limit })),
  totalElements: { count: totalElements, limit: GUIDELINES.elementsPerModel.limit, withinGuideline: totalElements <= GUIDELINES.elementsPerModel.limit, composition: 'pools, lanes, flow nodes, sequence and message flows, data references, annotations and associations' },
  guidelines: GUIDELINES
};
const readabilityFlags = [];
for (const l of readability.levels) {
  if (!l.withinGuideline) readabilityFlags.push(`process level "${l.level}" holds ${l.activities} activities, above the guideline of ${GUIDELINES.activitiesPerLevel.limit}`);
}
if (!readability.totalElements.withinGuideline) {
  readabilityFlags.push(`the model holds ${totalElements} elements, above the guideline of ${GUIDELINES.elementsPerModel.limit}`);
}
readability.flags = readabilityFlags;
if (args.strictReadability) for (const message of readabilityFlags) findings.push({ step: 'd', kind: 'readability', message });

// ---------------------------------------------------------------- summary
const blocking = findings.filter((f) => f.step !== 'd' || args.strictReadability);
const summary = {
  file: shortFile,
  verdict: blocking.length ? 'FAIL' : 'PASS',
  findingCount: blocking.length,
  steps: { schema, lint, structure, readability },
  findings: blocking
};
if (notes.length) summary.notes = notes;
console.log(JSON.stringify(summary, null, 1));

// Plain text, for the reader who does not want to parse JSON.
const line = (label, state, detail) => `  ${label.padEnd(14)} ${state.padEnd(8)} ${detail}`;
console.log('');
console.log(`BPMN check: ${summary.file}`);
console.log(line('(a) schema', schema.status, schema.status === 'skipped' ? `${schema.reason}. ${schema.howToInstall || ''}` : `xmllint against the OMG BPMN 2.0 XSD set`));
console.log(line('(b) lint', lint.status, lint.status === 'skipped' ? lint.reason : `bpmnlint:recommended, ${lint.findings.length === 1 ? '1 rule hit' : `${lint.findings.length} rule hits`}`));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
console.log(line('(c) structure', structure.status, structure.status === 'skipped' ? structure.reason : `${plural(structure.importWarnings.length, 'import warning', 'import warnings')}, parity ${structure.diParity.equal ? 'equal' : 'BROKEN'}, ${plural(structure.layoutIssues.length, 'layout issue', 'layout issues')}`));
const levelText = readability.levels.map((l) => `${l.level}: ${l.activities}`).join(', ');
console.log(line('(d) readability', readability.mode === 'enforced' ? 'enforced' : 'report', `activities per level (${levelText}); ${totalElements} elements in the model`));
console.log(`      ${GUIDELINES.activitiesPerLevel.source}`);
console.log(`      ${GUIDELINES.elementsPerModel.source}`);
for (const flag of readabilityFlags) console.log(`      above guideline: ${flag}`);
if (blocking.length) {
  console.log('');
  console.log(`${blocking.length} finding${blocking.length === 1 ? '' : 's'}:`);
  for (const f of blocking) console.log(`  [${f.step}] ${f.kind}: ${f.message}`);
}
console.log('');
const skippedNote = schema.status === 'skipped' ? ' (schema step skipped: xmllint not found)' : '';
console.log(blocking.length ? `VERDICT: FAIL, ${blocking.length} finding${blocking.length === 1 ? '' : 's'}${skippedNote}` : `VERDICT: PASS, no findings${skippedNote}`);
process.exit(blocking.length ? 1 : 0);
