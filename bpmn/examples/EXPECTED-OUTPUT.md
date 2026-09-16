# Expected output

Two runs of the checker, recorded from a real terminal. Reproduce them with:

```
cd bpmn
npm install
node scripts/check.mjs examples/purchase-request.bpmn   # exit code 0
node scripts/check.mjs examples/broken.bpmn             # exit code 1
```

Toolchain of the recorded runs: Node.js 25.8.0, bpmn-js 18.28.0, bpmnlint 11.14.0, Playwright 1.63.0 with headless Chromium, xmllint from libxml 20913, and the OMG BPMN 2.0 schema files taken from https://www.omg.org/spec/BPMN/20100501/ on the first run.

That first run on a fresh checkout also prints a short `notes` block, one line per schema file downloaded into `scripts/xsd/`. Later runs read the cached files and print no notes. Both runs write an SVG and a PNG rendering into `out/`.

## 1. examples/purchase-request.bpmn

A generic purchase request approval process: two pools (Requester as a black box, Company with the lanes Purchasing and Finance), eight activities, one exclusive gateway, one data object, one text annotation, two message flows.

Exit code: **0**

```
{
 "file": "examples/purchase-request.bpmn",
 "verdict": "PASS",
 "findingCount": 0,
 "steps": {
  "schema": {
   "step": "a",
   "name": "XML schema (OMG BPMN 2.0 XSD)",
   "status": "passed",
   "messages": [
    "examples/purchase-request.bpmn validates"
   ],
   "tool": "xmllint: using libxml version 20913",
   "schemaSource": "https://www.omg.org/spec/BPMN/20100501/",
   "schemaFiles": [
    "BPMN20.xsd",
    "Semantic.xsd",
    "BPMNDI.xsd",
    "DC.xsd",
    "DI.xsd"
   ],
   "schemaDir": "scripts/xsd"
  },
  "lint": {
   "step": "b",
   "name": "bpmnlint (bpmnlint:recommended)",
   "status": "passed",
   "findings": [],
   "raw": []
  },
  "structure": {
   "step": "c",
   "name": "bpmn-js import, diagram parity and layout",
   "status": "passed",
   "importWarnings": [],
   "diParity": {
    "modelElements": 33,
    "diagramElements": 33,
    "equal": true,
    "xmlCounts": {
     "participants": 2,
     "lanes": 2,
     "flowNodes": 12,
     "sequenceFlows": 11,
     "messageFlows": 2,
     "dataObjectRefs": 1,
     "dataStoreRefs": 0,
     "textAnnotations": 1,
     "associations": 1,
     "dataAssociations": 1
    }
   },
   "layoutIssues": [],
   "size": {
    "width": 1450,
    "height": 750
   },
   "pageBudget": {
    "width": 1600,
    "height": 1000,
    "note": "The page budget is a readability limit chosen by this repository, not a rule of the BPMN standard. Change it with --page WxH."
   },
   "exports": [
    "out/purchase-request.svg",
    "out/purchase-request.png"
   ]
  },
  "readability": {
   "step": "d",
   "name": "readability count",
   "mode": "report only",
   "levels": [
    {
     "level": "Company",
     "id": "Proc_Company",
     "activities": 8,
     "limit": 10,
     "withinGuideline": true
    }
   ],
   "totalElements": {
    "count": 33,
    "limit": 50,
    "withinGuideline": true,
    "composition": "pools, lanes, flow nodes, sequence and message flows, data references, annotations and associations"
   },
   "guidelines": {
    "activitiesPerLevel": {
     "limit": 10,
     "source": "Bruce Silver, BPMN Method and Style, style rule 0005: at most ten activities per process level."
    },
    "elementsPerModel": {
     "limit": 50,
     "source": "Seven Process Modeling Guidelines, guideline 7: decompose any model over fifty elements. Mendling, Reijers and van der Aalst, Information and Software Technology 52(2), 2010."
    }
   },
   "flags": []
  }
 },
 "findings": []
}

BPMN check: examples/purchase-request.bpmn
  (a) schema     passed   xmllint against the OMG BPMN 2.0 XSD set
  (b) lint       passed   bpmnlint:recommended, 0 rule hits
  (c) structure  passed   0 import warnings, parity equal, 0 layout issues
  (d) readability report   activities per level (Company: 8); 33 elements in the model
      Bruce Silver, BPMN Method and Style, style rule 0005: at most ten activities per process level.
      Seven Process Modeling Guidelines, guideline 7: decompose any model over fifty elements. Mendling, Reijers and van der Aalst, Information and Software Technology 52(2), 2010.

VERDICT: PASS, no findings
```

## 2. examples/broken.bpmn

The same file with two deliberate faults in the diagram section of the XML:

1. the shape of the data object `D1` was deleted, so the model holds an element that the diagram never draws;
2. the shapes of the tasks `T6` and `T7` were moved on top of each other.

Both faults are named in the output. The parity failure reads `diagram parity failure: the model holds 33 elements and the diagram draws 31`, next to the import warning that the data object is not drawn. The overlap reads `shapes overlap: T6 and T7`. bpmnlint reaches the same two faults through its own rules, `no-bpmndi` and `no-overlapping-elements`.

Exit code: **1**

```
{
 "file": "examples/broken.bpmn",
 "verdict": "FAIL",
 "findingCount": 6,
 "steps": {
  "schema": {
   "step": "a",
   "name": "XML schema (OMG BPMN 2.0 XSD)",
   "status": "passed",
   "messages": [
    "examples/broken.bpmn validates"
   ],
   "tool": "xmllint: using libxml version 20913",
   "schemaSource": "https://www.omg.org/spec/BPMN/20100501/",
   "schemaFiles": [
    "BPMN20.xsd",
    "Semantic.xsd",
    "BPMNDI.xsd",
    "DC.xsd",
    "DI.xsd"
   ],
   "schemaDir": "scripts/xsd"
  },
  "lint": {
   "step": "b",
   "name": "bpmnlint (bpmnlint:recommended)",
   "status": "failed",
   "findings": [
    "D1  error    Element is missing bpmndi            no-bpmndi",
    "T6  warning  Element overlaps with other element  no-overlapping-elements",
    "T7  warning  Element overlaps with other element  no-overlapping-elements"
   ],
   "raw": [
    "examples/broken.bpmn",
    "D1  error    Element is missing bpmndi            no-bpmndi",
    "T6  warning  Element overlaps with other element  no-overlapping-elements",
    "T7  warning  Element overlaps with other element  no-overlapping-elements",
    "✖ 3 problems (1 error, 2 warnings)"
   ]
  },
  "structure": {
   "step": "c",
   "name": "bpmn-js import, diagram parity and layout",
   "status": "failed",
   "importWarnings": [
    "element <bpmn:DataObjectReference id=\"D1\" /> referenced by <bpmn:DataOutputAssociation id=\"da1\" />#targetRef not yet drawn"
   ],
   "diParity": {
    "modelElements": 33,
    "diagramElements": 31,
    "equal": false,
    "xmlCounts": {
     "participants": 2,
     "lanes": 2,
     "flowNodes": 12,
     "sequenceFlows": 11,
     "messageFlows": 2,
     "dataObjectRefs": 1,
     "dataStoreRefs": 0,
     "textAnnotations": 1,
     "associations": 1,
     "dataAssociations": 1
    }
   },
   "layoutIssues": [
    {
     "kind": "overlap",
     "message": "shapes overlap: T6 and T7"
    }
   ],
   "size": {
    "width": 1450,
    "height": 750
   },
   "pageBudget": {
    "width": 1600,
    "height": 1000,
    "note": "The page budget is a readability limit chosen by this repository, not a rule of the BPMN standard. Change it with --page WxH."
   },
   "exports": [
    "out/broken.svg",
    "out/broken.png"
   ]
  },
  "readability": {
   "step": "d",
   "name": "readability count",
   "mode": "report only",
   "levels": [
    {
     "level": "Company",
     "id": "Proc_Company",
     "activities": 8,
     "limit": 10,
     "withinGuideline": true
    }
   ],
   "totalElements": {
    "count": 33,
    "limit": 50,
    "withinGuideline": true,
    "composition": "pools, lanes, flow nodes, sequence and message flows, data references, annotations and associations"
   },
   "guidelines": {
    "activitiesPerLevel": {
     "limit": 10,
     "source": "Bruce Silver, BPMN Method and Style, style rule 0005: at most ten activities per process level."
    },
    "elementsPerModel": {
     "limit": 50,
     "source": "Seven Process Modeling Guidelines, guideline 7: decompose any model over fifty elements. Mendling, Reijers and van der Aalst, Information and Software Technology 52(2), 2010."
    }
   },
   "flags": []
  }
 },
 "findings": [
  {
   "step": "b",
   "kind": "lint",
   "message": "D1  error    Element is missing bpmndi            no-bpmndi"
  },
  {
   "step": "b",
   "kind": "lint",
   "message": "T6  warning  Element overlaps with other element  no-overlapping-elements"
  },
  {
   "step": "b",
   "kind": "lint",
   "message": "T7  warning  Element overlaps with other element  no-overlapping-elements"
  },
  {
   "step": "c",
   "kind": "import-warning",
   "message": "element <bpmn:DataObjectReference id=\"D1\" /> referenced by <bpmn:DataOutputAssociation id=\"da1\" />#targetRef not yet drawn"
  },
  {
   "step": "c",
   "kind": "parity",
   "message": "diagram parity failure: the model holds 33 elements and the diagram draws 31"
  },
  {
   "step": "c",
   "kind": "overlap",
   "message": "shapes overlap: T6 and T7"
  }
 ]
}

BPMN check: examples/broken.bpmn
  (a) schema     passed   xmllint against the OMG BPMN 2.0 XSD set
  (b) lint       failed   bpmnlint:recommended, 3 rule hits
  (c) structure  failed   1 import warning, parity BROKEN, 1 layout issue
  (d) readability report   activities per level (Company: 8); 33 elements in the model
      Bruce Silver, BPMN Method and Style, style rule 0005: at most ten activities per process level.
      Seven Process Modeling Guidelines, guideline 7: decompose any model over fifty elements. Mendling, Reijers and van der Aalst, Information and Software Technology 52(2), 2010.

6 findings:
  [b] lint: D1  error    Element is missing bpmndi            no-bpmndi
  [b] lint: T6  warning  Element overlaps with other element  no-overlapping-elements
  [b] lint: T7  warning  Element overlaps with other element  no-overlapping-elements
  [c] import-warning: element <bpmn:DataObjectReference id="D1" /> referenced by <bpmn:DataOutputAssociation id="da1" />#targetRef not yet drawn
  [c] parity: diagram parity failure: the model holds 33 elements and the diagram draws 31
  [c] overlap: shapes overlap: T6 and T7

VERDICT: FAIL, 6 findings
```

## Reading the exit code

| Step | What it checks | Fails the run |
|---|---|---|
| (a) schema | XML validity against the OMG BPMN 2.0 XSD set, through xmllint | yes |
| (b) lint | bpmnlint with the recommended rule set | yes |
| (c) structure | bpmn-js import warnings, diagram parity, overlaps, lane and pool containment, the sequence flow versus message flow rule, orphan artefacts | yes |
| (d) readability | activities per process level and elements per model, against two published guidelines | only with `--strict-readability` |

When xmllint is absent, step (a) prints a `skipped` line with the install command for the platform and the run carries on through the other three steps. The `--page` size is a readability budget chosen here, so it is reported as a layout issue rather than as a breach of the standard.
