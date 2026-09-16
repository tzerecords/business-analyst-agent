---
name: bpmn
description: Draws a business process as a BPMN 2.0 Descriptive diagram from a written description, then checks notation and readability. Use when mapping or documenting a process. Not for execution engines.
argument-hint: "[check <file.bpmn>]"
allowed-tools: Bash, Read, Write
license: MIT
---
<!-- v1.0 | 2026-09-16 | Initial -->

# bpmn

BPMN is Business Process Model and Notation, the standard for drawing a business
process published by the Object Management Group (OMG). Descriptive is its
smallest conformance sub-class: the subset of shapes a business reader can
follow without training.

Given a process description, run the whole procedure below. Given
`check <file.bpmn>`, start at the checker in step 5 and finish at step 7.

## What this skill produces

1. `spec.json`, the process written as meaning only: pools, lanes, nodes, flows,
   documents, messages. No coordinates ever appear in it.
2. `<name>.bpmn`, a BPMN 2.0 XML file inside the Descriptive sub-class, laid out
   from the spec. One spec always produces one geometry, so re-running after an
   edit leaves the rest of the diagram alone. Any tool that reads the standard
   interchange format opens it.
3. Check report, printed by `check.mjs` to the terminal: a JSON summary, then a
   verdict line.
4. `<name>.svg` and `<name>.png`, written into the `--out` directory, to read
   before calling the diagram finished.

## Five habits

These five decide whether the output is worth showing to the people who do the
work.

**(a) Treat the checker as a gate.** Nothing is finished until `check.mjs` exits
0. Fix every finding in `spec.json`, then generate again. Never edit the `.bpmn`
file: it is a build output, so the next generate silently overwrites the fix.

**(b) Render it and look at it.** Once the checker passes, open the SVG it wrote
and read the diagram as somebody who has never seen this process. Every check can
pass on a diagram that no reader can follow, because the standard sets no size or
naming rule. Iterate on lane order, on names, and on where a level splits into a
collapsed sub-process, until the picture reads on its own.

**(c) Ask with options before writing.** Gaps in the description get a question,
never a guess; step 2 holds the shape of that question. Guessing an actor or a
decision outcome costs a redraw and hands the reader a process nobody knows.

**(d) Follow the templates literally.** Spec and closing report each have a
filled template below. Copy the shape. Fields added to the spec break the
generator, and fields added to the report bury what the reader came for.

**(e) Give every element its source.** Each task, gateway and event carries a
`documentation` field naming the sentence it came from, or the word `assumed`
plus the assumption. Untraceable elements cannot be reviewed.

## Procedure

#### 1. Read the description and list what is in it

Before drawing anything, write a plain list under five headings:

- **Actors.** Who does the work. Each organisation becomes a pool, each role or
  team inside the organisation that owns the process becomes a lane. Any outside
  party whose internal steps are unknown becomes a black-box pool: a named
  rectangle with no contents, connected by messages only.
- **Steps.** One verb phrase each, in the order they happen, named the way the
  person doing the work would say it.
- **Decisions.** Every point where the path forks, written as a question with
  its answers.
- **Documents.** Files, records and data stores the steps read or write.
- **Messages.** Anything that crosses from one pool to another.

#### 2. Ask about the gaps, then wait

Check that list against three questions: is every actor named, is it clear what
starts and what ends the process, and does every decision state all of its
outcomes. A description that answers all three has no gap, so skip to step 3
without asking anything.

Each gap earns one question, three in total at most. Ask them together, then
stop and wait. Every question stands on its own, quotes the sentence that left
the gap, offers lettered options a reader can pick without knowing the notation,
and marks one as recommended with the reason for it. Options read as the
business would say them, never as element types.

```
Q1. The description says the request "goes to finance", and never says what
    finance does when the budget is already spent.
    A. Finance rejects the request and the process ends there.
    B. Finance sends it back to purchasing for a cheaper quote. (recommended:
       your notes mention a second round of quotes)
    C. Finance approves it against next quarter's budget.
```

Anything still unconfirmed after the answers stays out of the model, or enters
with `assumed` and the assumption in its `documentation` field.

#### 3. Write the spec, from the template

Write `spec.json` to the template below, one path of a real spec, whose comments
carry the format. Semantics only, so never write an `x`, a `y`, a width or a
height. No extra fields, because the generator rejects them.

`id`, `name`, `pools`, `nodes` and `sequenceFlows` are always present, and every
pool that is not a black box carries a `processId` and at least one lane. Leave
out `messageFlows` when one pool holds the whole process, `associations` when
nothing carries an annotation, and `dataAssociations` when no step reads or
writes a document. The generator counts an absent one as empty.

```jsonc
{
  "id": "Defs_PR", "name": "Purchase request approval",
  // documentation: sources and date of the description behind this spec
  "documentation": "Interview notes, 12 March.", "collaborationId": "Collab_PR",
  // pools: top to bottom order here is the drawing order. blackBox marks an
  //   outside party, drawn as a named rectangle with no contents
  "pools": [
    {"id":"P_Req","name":"Requester","blackBox":true},
    {"id":"P_Co","name":"Company","processId":"Proc_Co","lanes":[
      {"id":"L_Buy","name":"Purchasing"},{"id":"L_Fin","name":"Finance"}]}],
  "nodes": [
    // flow node type: startEvent | endEvent | task | userTask | serviceTask
    //   | exclusiveGateway | parallelGateway | subProcess (collapsed)
    // eventDef, events only: message | timer | terminate | omitted for none
    // lane: required on every flow node. row: 0 by default, 1 puts the node on
    //   a second row inside the lane, only to keep parallel branches level
    // documentation: required on every task, gateway and event. Names the
    //   sentence behind the element, or says assumed plus the assumption
    {"id":"S1","type":"startEvent","eventDef":"message","lane":"L_Buy",
     "name":"Purchase request received","documentation":"notes line 2"},
    {"id":"T4","type":"userTask","name":"Prepare purchase order","lane":"L_Buy",
     "documentation":"notes line 8, drafted from the chosen quote"},
    {"id":"G1","type":"exclusiveGateway","lane":"L_Buy",
     "name":"Order value above the approval limit?",
     "documentation":"notes line 9, the single decision of the process"},
    {"id":"T5","type":"userTask","name":"Send the order to the supplier",
     "lane":"L_Buy","documentation":"assumed, who sends it was never stated"},
    {"id":"E1","type":"endEvent","name":"Order placed","lane":"L_Buy",
     "documentation":"notes line 11, end of the path with no approval"},
    // artefact type: dataObject | dataStore | annotation. Artefacts take no
    //   lane: each attaches to an anchor flow node, data drawn above it,
    //   annotation below it
    {"id":"D1","type":"dataObject","name":"Purchase order","anchor":"T4"},
    {"id":"A1","type":"annotation","text":"Limit set in the policy",
     "anchor":"G1"}],
  // name only on a gateway outflow, plain text, no condition expression.
  //   back: true marks a loop edge, routed underneath the row
  "sequenceFlows": [
    {"id":"f1","source":"S1","target":"T4"},{"id":"f2","source":"T4","target":"G1"},
    {"id":"f3","source":"G1","target":"T5","name":"Within the limit"},
    {"id":"f4","source":"T5","target":"E1"}],  // the other branch is cut here
  // message flow endpoints: a black-box pool id or a flow node id, and they
  //   always cross pools
  "messageFlows": [
    {"id":"m1","source":"P_Req","target":"S1","name":"Purchase request"}],
  "associations": [{"id":"as1","source":"G1","target":"A1"}],
  // task to data is an output, data to task is an input
  "dataAssociations": [{"id":"da1","source":"T4","target":"D1"}]
}
```

Task type convention: `userTask` for a person working in a system,
`serviceTask` for something a system does on its own, plain `task` for work done
away from any system. `manualTask` sits outside the Descriptive table, so work
on paper or over the phone takes plain `task` too.
`examples/purchase-request.spec.json` holds a longer worked spec.

#### 4. Size the levels before generating

Two published limits govern the shape of the model. Apply both while the spec is
still text, because fixing size after layout means rewriting the spec anyway.

- **Bruce Silver's BPMN Method and Style, style rule 0005: at most ten
  activities per process level**, the stated reason being that a level has to
  print on one page. Once a level grows past that, group a contiguous run of
  steps into a collapsed `subProcess` and move that run to its own level.
  Collapsed sub-process sits in the Descriptive table, so hierarchy costs
  nothing in conformance.
- **Guideline 7 of the Seven Process Modeling Guidelines: decompose any model
  over fifty elements.** Mendling, Reijers and van der Aalst, Information and
  Software Technology 52(2), 2010. Count every pool, lane, node, flow and
  artefact against that ceiling.

Choose sub-process boundaries where a reader would pause anyway, such as a
handover between teams. Naming one after the phase the business already uses
reads well, `Steps 4 to 9` does not.

#### 5. Generate, check, fix the spec

Run these from the folder that holds this SKILL.md: `bpmn/` in a clone of the
repository, or the skill folder itself once the skill is installed.

```bash
npm install                                   # once, per install
node scripts/generate.mjs spec.json out.bpmn
node scripts/check.mjs out.bpmn --out ./render --page 1600x1000
```

Layout comes from the generator, so hand-editing coordinates is never part of
this. Report text prints to the terminal, `--out` receives `out.svg` and
`out.png`, both named after the `.bpmn` file, and `--page` sets the
viewport the drawn size is measured against. Fix every finding in `spec.json`
and generate again, until the checker exits 0. Never edit the `.bpmn` file: the
next generate overwrites it.

#### 6. Render it and look at it

Open the SVG and read it cold, as somebody who has never seen this process. Ask:

- Can the labels be read at the size the whole diagram fits the page at? Any
  level that has to be panned in two directions is too wide.
- Does the happy path run left to right in one line, exceptions branching off it?
- Is there a large empty rectangle? Black-box pools stretched across the full
  width to carry two arrows signal a message that belongs elsewhere.
- Does every gateway read as a question whose answers label its outgoing flows?
- Would the person who does this work recognise their own job in it?

Iterate until the answers hold. **Passing the checker is not a design review.**

#### 7. Report

Close with this shape, filled from the run. No extra fields.

```
Process:     Purchase request approval
Files:       spec.json, out.bpmn, render/out.svg, render/out.png
Check:       PASS, 0 findings (schema, lint, structure, readability)
Shape:       2 pools, 2 lanes, 8 activities, 1 gateway, 33 elements
Assumed:     T5, who sends the order to the supplier was never stated
Still open:  none
```

## Allowed elements

Reproduced from OMG, Business Process Model and Notation (BPMN) Version 2.0,
formal/2011-01-03, Table 2.1, the Descriptive conformance sub-class, page 3.

```
 Element                                    Attributes
 participant (pool)                         id, name, processRef
 laneSet                                    id, lane with name, childLaneSet, flowElementRef
 sequenceFlow (unconditional)               id, name, sourceRef, targetRef
 messageFlow                                id, name, sourceRef, targetRef
 exclusiveGateway                           id, name
 parallelGateway                            id, name
 task (None)                                id, name
 userTask                                   id, name
 serviceTask                                id, name
 subProcess (expanded)                      id, name, flowElement
 subProcess (collapsed)                     id, name, flowElement
 CallActivity                               id, name, calledElement
 DataObject                                 id, name
 TextAnnotation                             id, text
 association/dataAssociation                id, name, sourceRef, targetRef, associationDirection
 dataStoreReference                         id, name, dataStoreRef
 startEvent (None)                          id, name
 endEvent (None)                            id, name
 messageStartEvent                          id, name, messageEventDefinition
 messageEndEvent                            id, name, messageEventDefinition
 timerStartEvent                            id, name, timerEventDefinition
 terminateEndEvent                          id, name, terminateEventDefinition
 documentation                              text
 Group                                      id, categoryRef
```

Nothing outside this table: no condition expression, no default flow, no
intermediate or boundary events, no attribute the table leaves out. Redraw any
step that falls outside it with an element on the list.

Generator support covers part of that table, no more. Its whole vocabulary is
the node type list in step 3 plus the artefact types `dataObject`, `dataStore`
and `annotation`. `CallActivity` and `Group` sit in the table and have no spec
field, so a process needing either one falls outside what this skill draws.

## What the checker reports

Four steps, in order. Steps a to c fail the run. Step d prints its counts and
leaves the verdict to you, unless `--strict-readability` fails on them too.

- **(a) Schema.** XML validity against the OMG BPMN 2.0 schema set.
- **(b) Lint.** Runs the bpmnlint recommended rule set: disconnected elements, a
  missing start or end event, a split or merge outside a gateway, and the rest.
- **(c) Structure.** Opens the file in a headless browser and checks import
  warnings, parity between the model and the diagram it draws, overlapping
  shapes and labels, lane and pool containment, a sequence flow that leaves its
  pool, a message flow that stays inside one, an unconnected artefact, and the
  drawn size against the `--page` budget.
- **(d) Readability.** Activities per process level against style rule 0005,
  total elements against guideline 7, each printed with its source.

Every finding names the element that caused it, which is how you find the spec
entry to change. Two rules sit outside what the checker sees, so hold them
yourself: every element comes from the Descriptive table above, and every
gateway outflow carries a name.

## What this skill does not do

- **No execution.** Output is a picture and a documentation artefact, with no
  condition expressions, no service bindings and no forms, so no workflow engine
  runs it. Executable modelling is a different conformance class.
- **No editing of hand-drawn diagrams.** Geometry placed by hand in a drawing
  tool stays unread here. Write the meaning as a fresh `spec.json` instead.
- **No judgement of the process itself.** Whether an approval step is redundant
  or a handover is slow stays a question for the people who run the work. This
  draws what is described, including the parts that look wrong.
