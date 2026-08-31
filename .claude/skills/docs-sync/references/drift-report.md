# Drift Report format

Emit at batch end / on request. Terse, action-first.

```
DRIFT — <date> — scope: <domains>

L3↔code (auto, no approval):
  [regen] notes/<domain> §<x>: <what fixed>
  [TODO]  notes/<domain>: <gap>

L2 candidates (need approval):
  [stale] L2-<DOM>-NN: diverged N commits.
     change: <1 line>   affects L3: <list>

L1 candidates (ask only, never edit):
  [friction] repeated L2 pressure across <domains> → review L1-<CAT>-NN.
     ask: <1 line>

Integrity:
  orphan L2 (no L1 cite): <list|none>
  broken ID refs: <list|none>
  L2↔L2 cycles: <list|none>
```

Rule: promote up = human. Demote/regen down = auto.
