# business-analyst

Business analysis skills, one folder per artefact. `bpmn` is the only one so far.
BPMN is Business Process Model and Notation, an Object Management Group standard.

## bpmn

Turns a written process description into a BPMN 2.0 diagram and checks it, inside
the Descriptive conformance sub-class: the subset of shapes a business reader
follows without training. No condition expressions and no service bindings, so no
workflow engine runs the output. A `.bpmn` file drawn by hand elsewhere is never
read back; write its meaning as a fresh spec. Format reference and the
Descriptive element table: `bpmn/SKILL.md`.

1. **List what the description holds.** Actors (one pool per organisation, one
   lane per role, a black box pool for an outside party whose internal steps are
   unknown), steps as verb phrases, decisions as questions with their answers,
   the documents each step reads or writes, plus the messages that cross between
   pools. Ask about anything ambiguous; any step nobody confirms stays out.
2. **Write `spec.json`, meaning only.** Pools, lanes, nodes, sequence flows,
   message flows, data associations, annotations. `messageFlows`,
   `associations` and `dataAssociations` can be left out when the process has
   none of them. Never write an `x`, a `y`, a width or a height. Node types:
   `startEvent`, `endEvent`, `task`, `userTask`, `serviceTask`,
   `exclusiveGateway`, `parallelGateway`, collapsed `subProcess`.
   Every flow node carries a `lane` and a `documentation` note, and every gateway
   outflow carries a name. Worked example:
   `bpmn/examples/purchase-request.spec.json`.
3. **Size the levels first.** At most ten activities per process level (Bruce
   Silver, BPMN Method and Style, style rule 0005) and at most fifty elements in
   the model (Seven Process Modeling Guidelines, guideline 7, Mendling, Reijers
   and van der Aalst, 2010). Past either ceiling, move a contiguous run of steps
   into a collapsed sub-process named after the phase the business already uses.
4. **Generate, then check.** Run both from `bpmn/`.

```bash
npm install                                              # once per install
node scripts/generate.mjs spec.json out.bpmn
node scripts/check.mjs out.bpmn --out ./render --page 1600x1000
```

5. **Fix every finding in `spec.json` and generate again.** Never edit the
   `.bpmn` file. It is a build output, and the next generate overwrites it.
6. **Open the SVG in the `--out` folder and read it** as somebody who has never
   seen this process: labels legible at the size the whole diagram fits the page,
   happy path left to right in one line, exceptions branching off it, every
   gateway a question whose answers label its outgoing flows. Passing the checker
   is not a design review: the standard sets no size limit, so a mechanically
   correct file can still be unusable in a meeting.

### What the checker reports

Four steps: (a) XML validity against the OMG BPMN 2.0 schema set, (b) the
bpmnlint recommended rule set, (c) structure, covering import warnings, parity
between model and diagram, overlapping shapes and labels, containment inside the
right lane and pool, a sequence flow that leaves its pool, a message flow that
stays inside one, orphan artefacts, drawn size against `--page`, and (d) readability
counts against the two guidelines above. Steps a to c fail the run with exit 1;
step d reports only, unless `--strict-readability` turns its counts into failures.
Every finding names the element behind it, which is how the spec entry to change
is found.
