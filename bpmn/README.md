# bpmn
Turns a written process description into a Business Process Model and Notation (BPMN) 2.0 diagram, checked and rendered.

## When to use
- A process lives in notes or in someone's head, and a diagram has to go in front of the people who do the work.
- A `.bpmn` file needs checking against the published schema, the lint rules and the readability limits.
- Steps changed, so the picture has to be redrawn from the meaning instead of patched by hand.

## How to use
Install: see the root README. Then type one of these three prompts:
```
Draw this as a BPMN diagram: a customer files a claim, an assessor reviews it, claims above the limit need a second approval.
check claims.bpmn
Update spec.json so a rejected claim returns to the assessor, then generate and check again.
```
Run the worked example:
```bash
cd bpmn && npm install                                 # once per checkout
node scripts/check.mjs examples/purchase-request.bpmn  # exit 0, PASS, no findings
node scripts/check.mjs examples/broken.bpmn            # exit 1, FAIL, 6 findings: the data object D1 has no shape in the diagram, and the tasks T6 and T7 overlap
```

## What is inside

| Name | What it is for |
|---|---|
| `SKILL.md` | Procedure to follow: list, ask, write the spec, size the levels, generate, check, render, report. |
| `scripts/generate.mjs` | Reads `spec.json` and writes the `.bpmn` file, layout included. One spec always gives one geometry. |
| `scripts/check.mjs` | Runs the schema, lint, structure and readability steps, then writes the SVG and the PNG to look at. |
| `scripts/fetch-xsd.mjs` | Downloads the published BPMN 2.0 schema files on first use and caches them for later runs. |
| `examples/` | Worked spec, the diagram it produces, and a deliberately broken file the checker fails. |
| `examples/EXPECTED-OUTPUT.md` | Both checker runs recorded from a terminal, to compare your own output against. |
| `.bpmnlintrc` | Points the lint step at the recommended rule set. |
| `package.json` | Dependencies, plus the generate and check shortcuts. |

## Limits
- No execution. Output is a picture and a document, so no workflow engine runs it.
- No editing of hand-drawn diagrams. Geometry placed by hand stays unread, so write the meaning as a fresh `spec.json`.
- No judgement of the process. What the description says gets drawn, including the parts that look wrong.
