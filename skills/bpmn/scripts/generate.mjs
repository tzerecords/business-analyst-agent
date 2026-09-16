// Deterministic BPMN 2.0 generator: a semantic spec.json becomes a .bpmn file that carries its own
// diagram interchange (DI, the part of the file that holds coordinates). No hand-written coordinates:
// every x and y comes from (pool order, lane order, topological column, row) and the metric table below.
// The same spec always produces the same file, so a diff shows a change of meaning, never a nudge of
// the mouse.
//
// Usage: node scripts/generate.mjs <spec.json> <out.bpmn>
// Format of the spec file: see SKILL.md, section "Write the spec"
import fs from 'fs';
const [,, specFile, outFile] = process.argv;
function die(message){ console.error(`generate.mjs: ${message}`); process.exit(2); }
if (!specFile || !outFile) die('usage: node scripts/generate.mjs <spec.json> <out.bpmn>');
if (!fs.existsSync(specFile)) die(`spec file not found: ${specFile}`);
let spec;
try { spec = JSON.parse(fs.readFileSync(specFile,'utf8')); }
catch (err) { die(`${specFile} is not valid JSON: ${err.message}`); }
// Three of the arrays carry meaning only when the process has it: one pool holding the whole
// process has no message flows, and a process with no annotation and no document has no
// associations. Each counts as empty when the spec leaves it out, so a small model needs no
// placeholder keys. The other three are always part of a process, so their absence is an error.
for (const key of ['messageFlows','associations','dataAssociations']) {
  if (spec[key] === undefined) spec[key] = [];
  else if (!Array.isArray(spec[key])) die(`"${key}" has to be an array`);
}
for (const key of ['pools','nodes','sequenceFlows']) {
  if (!Array.isArray(spec[key])) die(`"${key}" is required and has to be an array`);
}
for (const p of spec.pools) {
  if (p.blackBox) continue;
  if (!p.processId) die(`pool ${p.id} needs a processId, or blackBox: true for an outside party`);
  if (!Array.isArray(p.lanes) || !p.lanes.length) die(`pool ${p.id} needs at least one lane`);
}
const M = Object.assign({ pitch: 140, laneTopBand: 90, rowH: 110, rowGap: 70, laneBottom: 130, headerW: 30, poolGap: 40, bbH: 50, left: 20, top: 20,
  task:[110,90], event:[36,36], gateway:[50,50], data:[36,50], store:[50,50], annW:180, annH:44, subW:100, subH:70 }, spec.metrics||{});
const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const nodes = new Map(spec.nodes.map(n=>[n.id,n]));
const flowTypes = new Set(['startEvent','endEvent','userTask','serviceTask','manualTask','task','exclusiveGateway','parallelGateway','subProcess']);
const isFlow = n => flowTypes.has(n.type);
// Annotation height from a greedy word wrap at ~5.9px per character, the way the renderer breaks it,
// so the box the overlap test measures is the box the reader sees.
const annH = n => { const w = (n.w||M.annW) - 16; const cpl = Math.max(8, Math.floor(w/5.9));
  let lines = 1, len = 0;
  for (const word of String(n.text||'').split(/\s+/)) {
    const add = len ? len + 1 + word.length : word.length;
    if (add > cpl && len) { lines++; len = word.length; } else { len = add; }
  }
  return Math.max(M.annH, lines*13 + 16); };
const size = n => n.type.endsWith('Event') ? M.event : n.type.endsWith('Gateway') ? M.gateway : n.type==='dataObject' ? M.data : n.type==='dataStore' ? M.store : n.type==='annotation' ? [n.w||M.annW, n.h||annH(n)] : n.type==='subProcess' ? [M.subW,M.subH] : M.task;
// ---- columns: longest path over non-back sequence flows; same-lane consecutive nodes need a new column
const seq = spec.sequenceFlows; const preds = {}; spec.nodes.filter(isFlow).forEach(n=>preds[n.id]=[]);
seq.filter(f=>!f.back).forEach(f=>preds[f.target].push(f.source));
const col = {}; const order = []; const visiting = new Set();
function rank(id){ if (col[id]!==undefined) return col[id]; if (visiting.has(id)) throw new Error('cycle without back flag at '+id); visiting.add(id);
  const n = nodes.get(id); let c = 0;
  for (const p of preds[id]) { const pc = rank(p); const pn = nodes.get(p); c = Math.max(c, pc + 1); }
  if (n.col!==undefined) c = Math.max(c, n.col);
  if (preds[id].length===0 && n.col===undefined) c = 0;
  col[id]=c; visiting.delete(id); order.push(id); return c; }
spec.nodes.filter(isFlow).forEach(n=>rank(n.id));
// collision resolution per (lane,row): later nodes in topological order shift right
const occ = {}; for (const id of order){ const n=nodes.get(id); const key=n.lane+'#'+(n.row||0); occ[key]=occ[key]||new Set(); while(occ[key].has(col[id])) col[id]++; occ[key].add(col[id]); }
const maxCol = Math.max(...Object.values(col));
// ---- pools & lanes geometry
const rowsOf = {}; spec.nodes.forEach(n=>{ if(n.lane) rowsOf[n.lane]=Math.max(rowsOf[n.lane]||1,(n.row||0)+1); });
const poolW = M.headerW + (maxCol+1)*M.pitch + 20;
let y = M.top; const geo = {};
for (const p of spec.pools){ if (p.blackBox){ geo[p.id]={x:M.left,y,w:poolW,h:M.bbH}; y+=M.bbH+M.poolGap; continue; }
  let ly=y; for (const l of p.lanes){ const rows=rowsOf[l.id]||1; const h=M.laneTopBand+rows*M.rowH+(rows-1)*M.rowGap+M.laneBottom; geo[l.id]={x:M.left+M.headerW,y:ly,w:poolW-M.headerW,h,rows}; ly+=h; }
  geo[p.id]={x:M.left,y,w:poolW,h:ly-y}; y=ly+M.poolGap; }
const laneOf = {}; spec.pools.forEach(p=>(p.lanes||[]).forEach(l=>laneOf[l.id]=p.id));
// ---- node positions
for (const n of spec.nodes.filter(isFlow)){ const [w,h]=size(n); const L=geo[n.lane]; const cx=L.x+M.headerW+col[n.id]*M.pitch+M.pitch/2- M.headerW; const rowTop=L.y+M.laneTopBand+(n.row||0)*(M.rowH+M.rowGap);
  geo[n.id]={x:Math.round(cx-w/2), y:Math.round(rowTop+(M.rowH-h)/2), w, h}; }
// data objects/stores above their anchor task (same column); annotations below
const artefacts = spec.nodes.filter(n=>!isFlow(n)); artefacts.forEach(a=>{ a.lane = nodes.get(a.anchor).lane; });
const usedAbove = {}; const usedBelow = {};
for (const a of artefacts){ const anchor = geo[a.anchor]; if(!anchor) throw new Error('artefact '+a.id+' needs anchor'); const [w,h]=size(a); const an=nodes.get(a.anchor); const L=geo[an.lane];
  // A shape with an external label (gateway, event) already occupies the band right below it,
  // so its annotation goes further down and to the right; a task keeps its annotation directly below.
  if (a.type==='annotation'){ const hasLbl = an.type.endsWith('Gateway')||an.type.endsWith('Event');
    // A gateway/event keeps its own label in the band right below it, so its annotation drops further
    // and sits to the LEFT, in the gap of the previous column, clear of any second-row node.
    geo[a.id]={x:Math.round(hasLbl ? anchor.x+anchor.w/2-w-14+(a.dx||0) : anchor.x+anchor.w/2-90+(a.dx||0)), y:anchor.y+anchor.h+(hasLbl?56:8), w, h}; }
  else { const k=an.lane+'#'+col[an.id]; const i=(usedAbove[k]||0); usedAbove[k]=i+1; geo[a.id]={x:Math.round(anchor.x+(a.dx||0)+i*(w+120)), y:Math.round(L.y+2), w, h}; } }
// ---- edges
const c = g => ({cx:g.x+g.w/2, cy:g.y+g.h/2, r:g.x+g.w, b:g.y+g.h, l:g.x, t:g.y});
function seqWp(f){ const s=c(geo[f.source]), t=c(geo[f.target]);
  // A back edge runs along the bottom band of its lane, which the layout keeps empty, so it clears
  // the second row of nodes and the annotations that hang under the first row.
  if (f.back){ const ls = geo[nodes.get(f.source).lane], lt = geo[nodes.get(f.target).lane];
    const laneBottom = Math.min(ls.y + ls.h, lt.y + lt.h);
    const lanes = new Set([nodes.get(f.source).lane, nodes.get(f.target).lane]);
    let deepest = 0;
    for (const a of spec.nodes) { if (isFlow(a) || !lanes.has(a.lane) || !geo[a.id]) continue; deepest = Math.max(deepest, geo[a.id].y + geo[a.id].h); }
    const yb = Math.max(laneBottom - 16, deepest + 16) - (f.dy||0);
    return [[s.cx,s.b],[s.cx,yb],[t.cx,yb],[t.cx,t.b]]; }
  if (Math.abs(s.cy-t.cy)<1) return [[s.r,s.cy],[t.l,t.cy]];
  if (Math.abs(s.cx-t.cx)<1) return s.cy<t.cy ? [[s.cx,s.b],[t.cx,t.t]] : [[s.cx,s.t],[t.cx,t.b]];
  if (geo[f.source].x+geo[f.source].w < geo[f.target].x) { const mx = s.r + (geo[f.target].x - s.r)/2; return [[s.r,s.cy],[mx,s.cy],[mx,t.cy],[t.l,t.cy]]; }
  return s.cy<t.cy ? [[s.cx,s.b],[s.cx,(s.b+t.t)/2],[t.cx,(s.b+t.t)/2],[t.cx,t.t]] : [[s.cx,s.t],[s.cx,(s.t+t.b)/2],[t.cx,(s.t+t.b)/2],[t.cx,t.b]]; }
const msgSlot = {}; // node id + side -> count
function slot(nodeId, side){ const k=nodeId+'#'+side; const i=(msgSlot[k]||0); msgSlot[k]=i+1; return i; }
function msgWp(f){ const sg=geo[f.source], tg=geo[f.target]; const s=c(sg), t=c(tg); const sIsPool = !!spec.pools.find(p=>p.id===f.source), tIsPool=!!spec.pools.find(p=>p.id===f.target);
  if (sIsPool && !tIsPool){ const side = s.cy<t.cy ? 'top':'bottom'; const k=slot(f.target, side); f._slot=k; f._side=side; const off=Math.min(24, tg.w/2-8); const x=t.cx+off+12*k+12*(nodes.get(f.target).row||0); return side==='top' ? [[x,s.b],[x,t.t]] : [[x,s.t],[x,t.b]]; }
  if (!sIsPool && tIsPool){ const side = s.cy<t.cy ? 'bottom':'top'; const k=slot(f.source, side); f._slot=k; f._side=side; const off=Math.min(24, sg.w/2-8); const x=s.cx+off+12*k+12*(nodes.get(f.source).row||0); return side==='bottom' ? [[x,s.b],[x,t.t]] : [[x,s.t],[x,t.b]]; }
  if (Math.abs(s.cx-t.cx)<1) return s.cy<t.cy ? [[s.cx,s.b],[t.cx,t.t]] : [[s.cx,s.t],[t.cx,t.b]];
  const my = s.cy<t.cy ? (s.b+t.t)/2 : (s.t+t.b)/2; return s.cy<t.cy ? [[s.cx,s.b],[s.cx,my],[t.cx,my],[t.cx,t.t]] : [[s.cx,s.t],[s.cx,my],[t.cx,my],[t.cx,t.b]]; }
function artWp(src,tgt){ const sg=geo[src], tg=geo[tgt]; const s=c(sg), t=c(tg); const sArt = !isFlow(nodes.get(src)); const x = sArt ? s.cx : t.cx; return s.cy<t.cy ? [[x,s.b],[x,t.t]] : [[x,s.t],[x,t.b]]; }
// ---- XML
const X=[]; const DI=[];
X.push(`<?xml version="1.0" encoding="UTF-8"?>`);
X.push(`<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="${esc(spec.id)}" name="${esc(spec.name)}" targetNamespace="${esc(spec.targetNamespace||'http://example.com/bpmn')}" exporter="generate.mjs (deterministic layout)" exporterVersion="1.0">`);
const msgs = spec.messageFlows.map((f,i)=>({...f, msgId:'Msg_'+f.id}));
for (const n of spec.nodes.filter(n=>n.type==='dataStore')) X.push(`  <bpmn:dataStore id="Store_${n.id}" name="${esc(n.name)}" isUnlimited="true" />`);
X.push(`  <bpmn:collaboration id="${esc(spec.collaborationId||'Collab_1')}">`);
if (spec.documentation) X.push(`    <bpmn:documentation>${esc(spec.documentation)}</bpmn:documentation>`);
for (const p of spec.pools) X.push(`    <bpmn:participant id="${p.id}" name="${esc(p.name)}"${p.blackBox?'':` processRef="${p.processId}"`}${p.documentation?`><bpmn:documentation>${esc(p.documentation)}</bpmn:documentation></bpmn:participant>`:' />'}`);
for (const f of msgs) X.push(`    <bpmn:messageFlow id="${f.id}" name="${esc(f.name)}" sourceRef="${f.source}" targetRef="${f.target}"${f.documentation?`><bpmn:documentation>${esc(f.documentation)}</bpmn:documentation></bpmn:messageFlow>`:' />'}`);
X.push(`  </bpmn:collaboration>`);
const shape = (id, g, extra='', label)=>{ let s=`    <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"${extra}>\n      <dc:Bounds x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" />`; if(label) s+=`\n      <bpmndi:BPMNLabel><dc:Bounds x="${label.x}" y="${label.y}" width="${label.w}" height="${label.h}" /></bpmndi:BPMNLabel>`; return s+`\n    </bpmndi:BPMNShape>`; };
const edge = (id, wps, label)=>{ let s=`    <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">\n`+wps.map(([x,y])=>`      <di:waypoint x="${Math.round(x)}" y="${Math.round(y)}" />`).join('\n'); if(label) s+=`\n      <bpmndi:BPMNLabel><dc:Bounds x="${label.x}" y="${label.y}" width="${label.w}" height="${label.h}" /></bpmndi:BPMNLabel>`; return s+`\n    </bpmndi:BPMNEdge>`; };
const labelBelow = (g,w=90,h=28)=>({x:Math.round(g.x+g.w/2-w/2), y:g.y+g.h+4, w, h});
for (const p of spec.pools.filter(p=>!p.blackBox)){
  X.push(`  <bpmn:process id="${p.processId}" name="${esc(p.name)}" isExecutable="false">`);
  X.push(`    <bpmn:laneSet id="LaneSet_${p.processId}">`);
  for (const l of p.lanes){ X.push(`      <bpmn:lane id="${l.id}" name="${esc(l.name)}">`); spec.nodes.filter(n=>isFlow(n)&&n.lane===l.id).forEach(n=>X.push(`        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`)); X.push(`      </bpmn:lane>`); }
  X.push(`    </bpmn:laneSet>`);
  const inPool = n => laneOf[n.lane]===p.id;
  for (const n of spec.nodes.filter(inPool)){
    const doc = n.documentation?`<bpmn:documentation>${esc(n.documentation)}</bpmn:documentation>`:'';
    const inc = seq.filter(f=>f.target===n.id).map(f=>`<bpmn:incoming>${f.id}</bpmn:incoming>`).join('');
    const out = seq.filter(f=>f.source===n.id).map(f=>`<bpmn:outgoing>${f.id}</bpmn:outgoing>`).join('');
    if (n.type==='dataObject'){ X.push(`    <bpmn:dataObject id="DO_${n.id}" />`); X.push(`    <bpmn:dataObjectReference id="${n.id}" name="${esc(n.name)}" dataObjectRef="DO_${n.id}">${doc}</bpmn:dataObjectReference>`); continue; }
    if (n.type==='dataStore'){ X.push(`    <bpmn:dataStoreReference id="${n.id}" name="${esc(n.name)}" dataStoreRef="Store_${n.id}">${doc}</bpmn:dataStoreReference>`); continue; }
    if (n.type==='annotation') continue;
    let evd=''; if (n.eventDef==='message') evd=`<bpmn:messageEventDefinition id="${n.id}_med" />`; if (n.eventDef==='timer') evd=`<bpmn:timerEventDefinition id="${n.id}_ted" />`; if (n.eventDef==='terminate') evd=`<bpmn:terminateEventDefinition id="${n.id}_ted" />`;
    // data associations
    const ins = spec.dataAssociations.filter(a=>a.target===n.id), outs = spec.dataAssociations.filter(a=>a.source===n.id);
    let io=''; if (ins.length||outs.length){ io = `<bpmn:ioSpecification id="IO_${n.id}">`+ins.map(a=>`<bpmn:dataInput id="DIn_${a.id}" />`).join('')+outs.map(a=>`<bpmn:dataOutput id="DOut_${a.id}" />`).join('')+`<bpmn:inputSet id="IS_${n.id}">`+ins.map(a=>`<bpmn:dataInputRefs>DIn_${a.id}</bpmn:dataInputRefs>`).join('')+`</bpmn:inputSet><bpmn:outputSet id="OS_${n.id}">`+outs.map(a=>`<bpmn:dataOutputRefs>DOut_${a.id}</bpmn:dataOutputRefs>`).join('')+`</bpmn:outputSet></bpmn:ioSpecification>`; }
    const dIn = io + ins.map(a=>`<bpmn:dataInputAssociation id="${a.id}"><bpmn:sourceRef>${a.source}</bpmn:sourceRef><bpmn:targetRef>DIn_${a.id}</bpmn:targetRef></bpmn:dataInputAssociation>`).join('');
    const dOut = outs.map(a=>`<bpmn:dataOutputAssociation id="${a.id}"><bpmn:sourceRef>DOut_${a.id}</bpmn:sourceRef><bpmn:targetRef>${a.target}</bpmn:targetRef></bpmn:dataOutputAssociation>`).join('');
    const tag = n.type==='subProcess' ? 'subProcess' : n.type;
    X.push(`    <bpmn:${tag} id="${n.id}" name="${esc(n.name)}"${n.type==='exclusiveGateway'&&n.default?'':''}>${doc}${inc}${out}${dIn}${dOut}${evd}</bpmn:${tag}>`);
  }
  for (const f of seq.filter(f=>inPool(nodes.get(f.source)))) X.push(`    <bpmn:sequenceFlow id="${f.id}"${f.name?` name="${esc(f.name)}"`:''} sourceRef="${f.source}" targetRef="${f.target}"${f.documentation?`><bpmn:documentation>${esc(f.documentation)}</bpmn:documentation></bpmn:sequenceFlow>`:' />'}`);
  for (const n of spec.nodes.filter(n=>n.type==='annotation'&&inPool(n))) X.push(`    <bpmn:textAnnotation id="${n.id}"><bpmn:text>${esc(n.text)}</bpmn:text></bpmn:textAnnotation>`);
  for (const a of spec.associations.filter(a=>inPool(nodes.get(a.source)))) X.push(`    <bpmn:association id="${a.id}" sourceRef="${a.source}" targetRef="${a.target}" />`);
  X.push(`  </bpmn:process>`);
}
// DI
DI.push(`  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="${esc(spec.collaborationId||'Collab_1')}">`);
for (const p of spec.pools){ DI.push(shape(p.id, geo[p.id], ' isHorizontal="true"')); for (const l of (p.lanes||[])) DI.push(shape(l.id, geo[l.id], ' isHorizontal="true"')); }
for (const n of spec.nodes){ const g=geo[n.id]; let lbl; const lw=n.labelW||100, lh=n.labelH||28;
  if (n.type.endsWith('Gateway') && n.name) lbl=labelBelow(g, lw, lh);
  else if (n.type.endsWith('Event') && n.name) lbl=labelBelow(g, lw, lh);
  else if ((n.type==='dataObject'||n.type==='dataStore') && n.name) { const w2=n.labelW||92; lbl={x:Math.round(g.x+g.w/2-w2/2), y:g.y+g.h+4, w:w2, h:lh}; }
  DI.push(shape(n.id, g, n.type==='subProcess'?' isExpanded="false"':'', lbl)); }
for (const f of seq){ const wps=seqWp(f); let lbl; if (f.name){ const lw=f.labelW||90, lh=16;
    // A back edge carries its label at the midpoint of its long horizontal run, above the line:
    // the band right under the source belongs to the gateway label and to any annotation.
    if (f.back){ const [xa,ya]=wps[1], [xb]=wps[2]; const h2=30; lbl={x:Math.round((xa+xb)/2-lw/2), y:Math.round(ya-h2-6), w:lw, h:h2}; }
    else { const [xa,ya]=wps[wps.length-2]; const [xb,yb]=wps[wps.length-1];
      if (ya===yb) lbl={x:Math.round(xb-lw-6), y:Math.round(yb-lh-4), w:lw, h:lh};                 // last segment horizontal: above it, next to the target
      else lbl={x:Math.round(xb+8), y:Math.round(yb + (yb>ya? -lh-10 : 10)), w:lw, h:lh}; } }      // last segment vertical: beside it, next to the target
  DI.push(edge(f.id, wps, lbl)); }
for (const f of msgs){ const wps=msgWp(f); let lbl; if (f.name){ const sIsPool=!!spec.pools.find(p=>p.id===f.source); const [x0,y0]=wps[0]; const [x1,y1]=wps[wps.length-1]; const lw=f.labelW||110, lh=16; let k=f._slot||0;
    const node = geo[sIsPool ? f.target : f.source]; const cnt = msgSlot[(sIsPool?f.target:f.source)+'#'+f._side]||1; const py = sIsPool ? y1 : y0;
    const xl = node.x + node.w/2 + Math.min(24, node.w/2-8) + 12*(cnt-1) + 6;
    // all message labels sit next to the external pool edge, stacked per node side (k = slot)
    const poolY = sIsPool ? y0 : y1; const lx = (sIsPool ? x1 : x0) + 6; k += (nodes.get(sIsPool?f.target:f.source).row||0);
    lbl = f._side==='top' ? {x:Math.round(lx), y:Math.round(poolY + 6 + 32*k), w:lw, h:lh} : {x:Math.round(lx), y:Math.round(poolY - lh - 6 - 32*k), w:lw, h:lh}; }
  DI.push(edge(f.id, wps, lbl)); }
for (const a of spec.associations) DI.push(edge(a.id, artWp(a.source,a.target)));
for (const a of spec.dataAssociations) DI.push(edge(a.id, artWp(a.source,a.target)));
DI.push(`  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`);
X.push(...DI); X.push(`</bpmn:definitions>`);
fs.writeFileSync(outFile, X.join('\n')+'\n');
console.log(JSON.stringify({cols:maxCol+1, width:poolW+2*M.left, height:y-M.poolGap+M.top, nodes:spec.nodes.length}));
