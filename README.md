# business-analyst

Skills that do business analysis work. One skill so far: `bpmn`, which turns a
written process description into a BPMN 2.0 diagram and checks it. BPMN is
Business Process Model and Notation, the standard for drawing a business process
published by the Object Management Group.

Every skill here is a folder holding one written procedure and the scripts that
procedure runs, loaded when a task matches its description. Each one covers a
single artefact a business analyst is asked to produce. Planned skills are under
Roadmap.

What the checker does, run from `bpmn/` after `npm install`:

```bash
node scripts/check.mjs examples/purchase-request.bpmn  # exit 0, PASS, no findings
node scripts/check.mjs examples/broken.bpmn            # exit 1, FAIL, 6 findings: the data object D1 has no shape in the diagram, and the tasks T6 and T7 overlap
```

First run needs the network and `xmllint`: the schema step downloads the OMG
BPMN 2.0 schema files into `scripts/xsd/` and caches them there, so later runs
work offline. Without `xmllint` on the path that step reports itself skipped and
the other three still run.

## bpmn

Turns a written process description into a BPMN 2.0 diagram, inside the
Descriptive conformance sub-class of the standard: the subset of shapes a
business reader follows without training. Every process is written first as a
spec holding meaning and no coordinates, then laid out by a generator, so one
spec always gives one geometry. Checks then run over notation and readability,
and the diagram is drawn as an image to look at before it is called finished.

#### Install

Five routes. Take the first that fits the tool you work in.

**Claude Code, plugin marketplace.** Add the marketplace, then install the
plugin. These are two separate prompts inside Claude Code, and the install will
not work if they are sent as one:

```
/plugin marketplace add tzerecords/matias-was
```

```
/plugin install business-analyst@matias-was
```

Skill name after installing: `/business-analyst:bpmn`.

**Claude Code, clone into your personal skills directory.** No marketplace entry
and no change to your Claude Code configuration:

```bash
git clone https://github.com/tzerecords/matias-was /tmp/matias-was
cp -r /tmp/matias-was/bpmn ~/.claude/skills/bpmn
```

Symlinking works the same way and keeps the checkout as the single copy:
`ln -s /tmp/matias-was/bpmn ~/.claude/skills/bpmn`. Skill name after installing:
`/bpmn`.

**Codex.**

```bash
codex plugin marketplace add tzerecords/matias-was
codex plugin add business-analyst@matias-was
```

**Gemini CLI.**

```bash
gemini extensions install https://github.com/tzerecords/matias-was
```

**Any coding tool that reads AGENTS.md.** Clone the repository and open it as
the working directory. `AGENTS.md` at the root holds the same procedure in plain
markdown, short enough to sit in context for a whole session, so the scripts run
with no plugin and no marketplace:

```bash
git clone https://github.com/tzerecords/matias-was
cd matias-was/bpmn && npm install
```

**Without any coding agent at all.** Generator and checker are plain Node
scripts, and neither one calls a language model. Run the worked example first,
then write your own spec against the format documented in `bpmn/SKILL.md`:

```bash
git clone https://github.com/tzerecords/matias-was
cd matias-was/bpmn
npm install
node scripts/generate.mjs examples/purchase-request.spec.json out.bpmn
node scripts/check.mjs out.bpmn --out ./render --page 1600x1000
```

#### Usage

Say what you want in your own words. Sentences that reach this skill:

- "Map our order to cash process as a BPMN diagram from these interview notes."
- "Draw the purchase approval flow, with finance as a separate lane and the
  supplier as an outside party."
- "Turn this procedure document into a process model I can put in front of the
  team on Thursday."

`bpmn/examples/` holds a worked spec and the files generated from it.

#### Checking a model

```bash
node scripts/check.mjs <file.bpmn> [--out <dir>] [--page WxH]
```

Point it at `examples/purchase-request.bpmn` to watch it pass, and at
`examples/broken.bpmn` to watch it fail: the second file is the first one with
two faults planted in the drawing, a deleted shape and two tasks moved on top of
each other. Both runs are recorded line for line in
`bpmn/examples/EXPECTED-OUTPUT.md`, with the exit codes and the version of every
tool that produced them.

Four steps run in order. Schema: XML validity against the OMG BPMN 2.0 schema
set. Lint: the bpmnlint recommended rule set, which catches disconnected
elements, a missing start or end event, and a split or merge made anywhere
other than a gateway. Structure: the file opened in a headless browser, checked
for import warnings, parity between the model and the diagram it draws,
overlapping shapes and labels, lane and pool containment, a sequence flow that
leaves its pool, a message flow that stays inside one, an artefact left with no
connection, and the drawn size against the page budget. Readability: activities
per process level and total element count, each reported against a published
guideline and printed with its source. Anything the first three steps report
fails the run, and every finding names the element behind it.

A run given `--out` also writes an SVG and a PNG drawing of the model into that
directory. No step stops a diagram nobody can read, because the standard sets no
size limit, so a file can pass every mechanical check and still be unusable in a
meeting. Reading the drawing is the only gate for that.

#### Limits

Execution is not covered. Output carries no condition expressions, no service
bindings and no forms, so no workflow engine runs it. Executable modelling is a
different conformance class.

Hand-drawn diagrams are out of scope. Geometry inside a `.bpmn` file that came
out of a drawing tool was placed by hand, and these scripts do not read it.
Write its meaning as a fresh spec instead.

Nothing here judges the process. Whether an approval is redundant or a handover
is slow stays a question for the people who run the work, and what gets drawn is
what was described, including the parts that look wrong.

## Roadmap

No dates on any of it.

- **`bpmn` version 1.1: a review page.** Open the generated diagram in a page,
  click any element, and leave a note on it. Notes come back as edits to the
  spec, so a review round never touches the `.bpmn` file by hand.
- **`data-model`**, not written yet.
- **`requirements`**, not written yet.

## Licence

MIT. See `LICENSE`.
