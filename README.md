# business-analyst-agent

*an agent for business analysis work, built one skill at a time*

**Work in progress.** This repository is built one skill at a time. Today one skill is installable, `bpmn`.
Everything else is named under Roadmap and cannot be installed yet.

## bpmn

Turns a written process into a BPMN 2.0 diagram: it asks when the description has gaps, lays the shapes out from the meaning alone so one description always gives one geometry, checks the result, and renders it to look at. BPMN is Business Process Model and Notation, the standard for drawing a business process published by the Object Management Group.
```bash
cd bpmn && npm install                                 # once per checkout
node scripts/check.mjs examples/purchase-request.bpmn  # exit 0, PASS, no findings
node scripts/check.mjs examples/broken.bpmn            # exit 1, FAIL, 6 findings: the data object D1 has no shape in the diagram, and the tasks T6 and T7 overlap
```
Readability is counted separately: activities per process level and total elements against Bruce Silver's BPMN Method and Style and the Seven Process Modeling Guidelines, each count printed with its source.

## Before / after

You write what happens, in the words you would use in a meeting:

> Someone raises a purchase request and sends it to their manager. Managers approve it
> or return it with a comment. Approved requests go to purchasing, which places the
> order with the supplier and files the confirmation.

What comes back is a `.bpmn` file that any tool reading the standard interchange format opens, a checker verdict that either passes or names every finding and the element behind it, and an SVG drawing to read before the diagram goes in front of anyone.

## Install

**Claude Code.** Send these as two separate prompts; the install fails if they arrive as one.
```
/plugin marketplace add tzerecords/business-analyst-agent
```
```
/plugin install business-analyst@business-analyst-agent
```
**Codex.**
```bash
codex plugin marketplace add tzerecords/business-analyst-agent
codex plugin add business-analyst@business-analyst-agent
```
**Gemini CLI.**
```bash
gemini extensions install https://github.com/tzerecords/business-analyst-agent
```
**Any coding tool that reads AGENTS.md.** Clone the repository and open it as the working directory. `AGENTS.md` at the root holds the same procedure in plain markdown.
```bash
git clone https://github.com/tzerecords/business-analyst-agent
cd business-analyst-agent/bpmn && npm install
```
**Without any coding tool.** Generator and checker are plain Node scripts, and neither one calls a language model. Run the worked example, then write your own spec against the format documented in `bpmn/SKILL.md`.
```bash
git clone https://github.com/tzerecords/business-analyst-agent
cd business-analyst-agent/bpmn
npm install
node scripts/generate.mjs examples/purchase-request.spec.json out.bpmn
node scripts/check.mjs out.bpmn --out ./render --page 1600x1000
```

## Roadmap
Named only, none installable yet, no dates.

- `bpmn` 1.1, a review page: click an element, leave a note on it, the note is applied to the spec.
- `data-model`
- `requirements`

## Licence

MIT. See `LICENSE`.
