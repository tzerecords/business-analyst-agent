// Downloads the OMG BPMN 2.0 XML Schema Definition (XSD) files into scripts/xsd/ on first use.
// The files are never committed: they belong to the Object Management Group (OMG) and the checker
// reads them from the canonical URL so that the schema in use is the published one.
//
// Usage: node scripts/fetch-xsd.mjs [--force]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const XSD_DIR = path.join(HERE, 'xsd');
export const XSD_BASE = 'https://www.omg.org/spec/BPMN/20100501/';
// BPMN20.xsd is the entry point. It includes Semantic.xsd and imports BPMNDI.xsd, which in turn
// imports DC.xsd (Diagram Common) and DI.xsd (Diagram Interchange).
export const XSD_FILES = ['BPMN20.xsd', 'Semantic.xsd', 'BPMNDI.xsd', 'DC.xsd', 'DI.xsd'];

export async function fetchXsd({ force = false, log = () => {} } = {}) {
  fs.mkdirSync(XSD_DIR, { recursive: true });
  const downloaded = [];
  for (const name of XSD_FILES) {
    const target = path.join(XSD_DIR, name);
    if (!force && fs.existsSync(target) && fs.statSync(target).size > 0) continue;
    const url = XSD_BASE + name;
    log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not download ${url}: HTTP ${res.status}`);
    const body = await res.text();
    if (!body.includes('<xsd:schema')) throw new Error(`unexpected content at ${url}`);
    fs.writeFileSync(target, body);
    downloaded.push(name);
  }
  return { dir: XSD_DIR, downloaded, entry: path.join(XSD_DIR, 'BPMN20.xsd') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  const out = await fetchXsd({ force, log: (m) => console.log(m) });
  console.log(JSON.stringify({ dir: out.dir, downloaded: out.downloaded, upToDate: XSD_FILES.length - out.downloaded.length }, null, 1));
}
