// Mock Jira-health data, modeled on the MA PDLC Jira SOP (June 2026, v7).
//
// DESIGN CONSTRAINTS (from how the Jira instance is actually configured):
//   • Every metric here is AUTO-PULLABLE from Jira — via JQL (field values),
//     the issue changelog (status history / time-in-status), or issue links.
//     Nothing requires manual scoring.
//   • VALIDATORS are enforced:
//       (a) the mandatory-field validator fires on the move to "In Progress"
//           (from To Do OR Ready for Work) — that transition shows a screen
//           requiring the mandatory fields. Moving To Do <-> Ready for Work, or
//           into Blocked / On hold / Cancelled, only needs a comment, NOT fields.
//       (b) transitions are restricted to valid next statuses.
//     => Mandatory-field gaps can ONLY exist BEFORE "In Progress" — issues in
//        To Do or Ready for Work (or Blocked / On hold reached without ever
//        starting). Once an issue has been In Progress+, its mandatory fields are
//        guaranteed present, so those fields are trustworthy by construction.
//        NOTE: reaching "Ready for Work" does NOT imply fields are complete.
//     => "Invalid workflow" / "skipped status" cannot happen, so we don't report
//        them. What a validated workflow still allows to go wrong is FLOW: work
//        stalls, ages, goes stale, or holds valid-but-wrong values.
//
// The genuine trust risks therefore reduce to:
//   1. the Major Theme layer (ABOVE Initiative) — new for exec reporting, NOT
//      yet a mandatory field / validator, so linkage is incomplete (`isNew`);
//   2. staleness — an issue's status may no longer reflect reality;
//   3. valid-but-wrong values a field validator can't catch (oversized story
//      points, due-before-start, open-but-overdue).
//
// All numbers are illustrative.

export const SNAPSHOT = "2026-06-12";

export const BUS = [
  "Asset Management", "Banking", "C&G", "DC&I",
  "Platform Engineering", "Data Estate", "Insurance",
];

export const RAG = { Green: "#16A34A", Amber: "#F59E0B", Red: "#DC2626" };
export const ragOf = (score) => (score >= 82 ? "Green" : score >= 68 ? "Amber" : "Red");

// ---- Teams (BU – Squad) -----------------------------------------------------
// Four auto-pullable, validator-safe dimensions (0-100, higher is better):
//   readiness = % of issues that have passed the mandatory-field gate, i.e.
//               reached "In Progress"+ (the validator fires on that move).
//               Issues still in To Do / Ready for Work may have incomplete
//               fields, so this measures "are mandatory fields filled".
//               [JQL: status In Progress+]
//   freshness = % of open issues updated within SLA (not stale).  [changelog]
//   flow      = in-flight health: not blocked-aged, WIP not aging. [changelog]
//   linkage   = % of initiatives linked up to a Major Theme + children
//               correctly parented (Major Theme = emerging).      [issue links]
// Four component scores (0-100), one per Readiness & Flow check:
//   planning = planning-horizon adherence  ·  fields = mandatory-field completeness
//   workflow = status-funnel health         ·  flow   = flow & aging health
// Health rolls all four up using the weights defined in TEAM_COMPONENTS.
// (linkage is still accepted but no longer scored — Major Theme links are
// enforced, so orphaned issues can't persist.)
function team(bu, squad, issues, planning, fields, workflow, flow, linkage) {
  const s = { planning, fields, workflow, flow, linkage };
  const health = Math.round(TEAM_COMPONENTS.reduce((a, c) => a + s[c.key] * c.weight, 0) / 100);
  const stories = Math.round(issues * 0.5);
  const initiatives = Math.max(2, Math.round(issues * 0.07));
  const inv = (s, rate) => Math.round((issues * rate * (100 - s)) / 100);
  const flags = {
    createdLate: inv(planning, 0.14),     // horizon items created too late
    gateBacklog: inv(fields, 0.6),        // not-yet-started, mandatory fields incomplete
    stale: inv(flow, 0.55),               // > 14 days, no update
    agingWip: inv(flow, 0.22),            // In Progress > 30 days
    blockedAged: inv(workflow, 0.18),     // Blocked > 30 days
    oversized: Math.round((stories * 0.08 * (140 - flow)) / 100), // story points > 8
    initiatives,
    orphanTheme: Math.max(0, Math.round((initiatives * (100 - linkage)) / 100)),
  };
  return { id: `${bu} – ${squad}`, bu, squad, issues, planning, fields, workflow, flow, linkage, health, flags };
}

// The four scoring mechanisms behind team health (anchored on the Readiness &
// Flow checks), their weights, and how each 0-100 score is derived.
// `green` / `amber` are this component's RAG thresholds (≥green = Green,
// ≥amber = Amber, else Red) — judged per metric and rounded to the nearest 5%.
export const TEAM_COMPONENTS = [
  { key: "planning", label: "Planning horizons", weight: 20, green: 80, amber: 65, explain: "Share of horizon-bound issues — Major Themes, Initiatives and Epics — created on time, with enough lead time before their start date (the 12 / 6 / 3-month horizons). Higher means work is planned ahead rather than created late." },
  { key: "fields", label: "Mandatory fields", weight: 30, green: 85, amber: 70, explain: "% of mandatory fields filled in across the squad's To Do and Ready for Work issues. Higher means issues are refined and ready to move to In Progress." },
  { key: "workflow", label: "Status funnel", weight: 25, green: 75, amber: 60, explain: "% of the squad's issues that are not Blocked, On hold or Cancelled — i.e. healthy, in-flow work rather than stalled or abandoned." },
  { key: "flow", label: "Flow & aging", weight: 25, green: 85, amber: 65, explain: "Share of issues free of aging / flow risks — not stale (>14d), not long-blocked (>30d), not past due and not oversized (>8 SP). Higher means work keeps moving and the data stays fresh." },
];
// Overall-health RAG thresholds (also per-metric, rounded to nearest 5%).
export const HEALTH_RAG = { green: 80, amber: 70 };

export const TEAMS = [
  team("Asset Management", "Portfolio Analytics", 142, 86, 90, 88, 89, 95),
  team("Asset Management", "Risk Models", 98, 80, 85, 83, 84, 88),
  team("Banking", "Credit Lens", 176, 66, 72, 70, 71, 60),
  team("Banking", "Lending Platform", 121, 50, 58, 56, 57, 35),
  team("C&G", "Compliance Catalyst", 154, 88, 88, 85, 86, 92),
  team("C&G", "Entity Verification", 64, 86, 87, 84, 85, 90),
  team("C&G", "KYC", 89, 70, 75, 72, 73, 66),
  team("DC&I", "Data Insights", 67, 56, 64, 60, 62, 40),
  team("Platform Engineering", "Core Services", 133, 84, 86, 84, 88, 90),
  team("Platform Engineering", "Identity", 78, 68, 74, 71, 72, 72),
  team("Data Estate", "Ingestion", 95, 52, 60, 57, 56, 30),
  team("Data Estate", "Governance", 72, 64, 70, 68, 69, 58),
  team("Insurance", "Actuarial", 110, 80, 83, 81, 84, 86),
  team("Insurance", "Claims", 102, 72, 76, 74, 73, 64),
];

// ---- Weighted aggregates ----------------------------------------------------
const totalIssues = TEAMS.reduce((a, t) => a + t.issues, 0);
const wavg = (f) => Math.round(TEAMS.reduce((a, t) => a + t.issues * t[f], 0) / totalIssues);
const sumFlag = (k) => TEAMS.reduce((a, t) => a + t.flags[k], 0);

export const OVERALL = {
  totalIssues,
  planning: wavg("planning"),
  fields: wavg("fields"),
  workflow: wavg("workflow"),
  flow: wavg("flow"),
  health: wavg("health"),
};
export const TEAMS_ATTENTION = TEAMS.filter((t) => t.health < 82);
export const GATE_STUCK = sumFlag("gateBacklog");
export const STALE_TOTAL = sumFlag("stale");
export const BLOCKED_AGED = sumFlag("blockedAged");
export const ORPHAN_THEME = sumFlag("orphanTheme");
export const OVERSIZED = sumFlag("oversized");

// ===== Q1: Readiness & Flow ==================================================
// (a) Outstanding mandatory fields. Issues can legitimately sit in To Do /
// Ready for Work while they're refined. The mandatory-field validator fires on
// the move to In Progress, so any not-yet-completed fields live on those not-
// yet-started issues. This is "which mandatory field is still to be filled in
// before an issue can start", filterable by issue type — JQL:
//   type = <type> AND status IN ("To Do","Ready for Work") AND <field> IS EMPTY
export const GATE_TYPES = ["Major Theme", "Initiative", "Epic", "User Story", "Task", "Bug", "Subtask"];
export const GATE_STATUSES = ["To Do", "Ready for Work"];

// Per issue type: total issues of that type, and how many (not yet started)
// still need each mandatory field filled in — split by current status
// (toDo = in To Do, rfw = in Ready for Work). `applicable` for a field is the
// sum of the totals of the selected types that require it.
const GATE_BY_TYPE = {
  "Major Theme": { total: 18, fields: [
    { field: "OKR – Key Results", toDo: 3, rfw: 1 },
    { field: "Due date", toDo: 2, rfw: 1 },
  ] },
  "Initiative": { total: 86, fields: [
    { field: "Product Subgroup(s)", toDo: 11, rfw: 7 },
    { field: "OKR – Key Results", toDo: 9, rfw: 5 },
    { field: "Due date", toDo: 8, rfw: 4 },
    { field: "Priority", toDo: 6, rfw: 3 },
    { field: "Team(s)", toDo: 5, rfw: 2 },
  ] },
  "Epic": { total: 240, fields: [
    { field: "Product Subgroup(s)", toDo: 26, rfw: 14 },
    { field: "Epic t-shirt size", toDo: 24, rfw: 12 },
    { field: "OKR – Key Results", toDo: 18, rfw: 10 },
    { field: "Due date", toDo: 16, rfw: 8 },
    { field: "Priority", toDo: 12, rfw: 6 },
    { field: "Team(s)", toDo: 9, rfw: 5 },
  ] },
  "User Story": { total: 610, fields: [
    { field: "Acceptance criteria", toDo: 68, rfw: 36 },
    { field: "Story points", toDo: 56, rfw: 32 },
    { field: "Product Subgroup(s)", toDo: 45, rfw: 25 },
    { field: "Due date", toDo: 32, rfw: 18 },
    { field: "Team(s)", toDo: 16, rfw: 9 },
  ] },
  "Task": { total: 180, fields: [
    { field: "Story points", toDo: 19, rfw: 11 },
    { field: "Product Subgroup(s)", toDo: 14, rfw: 8 },
    { field: "Due date", toDo: 12, rfw: 6 },
    { field: "Team(s)", toDo: 6, rfw: 4 },
  ] },
  "Bug": { total: 150, fields: [
    { field: "Severity", toDo: 16, rfw: 8 },
    { field: "Environment", toDo: 13, rfw: 7 },
    { field: "Priority", toDo: 10, rfw: 6 },
    { field: "Due date", toDo: 8, rfw: 4 },
  ] },
  "Subtask": { total: 220, fields: [
    { field: "Story points", toDo: 18, rfw: 10 },
    { field: "Assignee", toDo: 12, rfw: 6 },
  ] },
};
const FIELD_NOTES = { "Acceptance criteria": "usually written during refinement", "Story points": "estimated during refinement" };

// Aggregate the per-type field gaps over selected issue types and statuses.
// `types` lists only the selected types that require the field.
export function gateRows(selectedTypes, selectedStatuses) {
  const statuses = selectedStatuses || GATE_STATUSES;
  const wantToDo = statuses.includes("To Do");
  const wantRfw = statuses.includes("Ready for Work");
  const acc = {};
  (selectedTypes || []).forEach((type) => {
    const d = GATE_BY_TYPE[type];
    if (!d) return;
    d.fields.forEach((f) => {
      const miss = (wantToDo ? f.toDo : 0) + (wantRfw ? f.rfw : 0);
      if (miss === 0) return;
      if (!acc[f.field]) acc[f.field] = { field: f.field, missing: 0, applicable: 0, types: [] };
      acc[f.field].missing += miss;
      acc[f.field].applicable += d.total;
      acc[f.field].types.push(type);
    });
  });
  return Object.values(acc)
    .map((a) => ({ ...a, pct: Math.round((a.missing / a.applicable) * 100), types: a.types.join(" · "), note: FIELD_NOTES[a.field] }))
    .sort((x, y) => y.missing - x.missing);
}

// (b) Planning horizons. With the Major Theme layer added on top, the SOP's
// rolling cadence shifts DOWN a level: a Major Theme should exist ~12 months
// ahead, Initiatives ~6, Epics ~3; items below (User Story / Task / Bug /
// Subtask) have no forward horizon — they're created within the sprint as needed.
export const PLANNING_HORIZONS = [
  { type: "Major Theme", months: 12, isNew: true },
  { type: "Initiative", months: 6 },
  { type: "Epic", months: 3 },
  { type: "User Story / Task / Bug / Subtask", months: null },
];

// Planning-horizon adherence — were issues created ON TIME vs their horizon
// (enough lead time before their start date)? Sliced by how far back we look at
// the CREATED date. Items created too late (less lead time than the cadence
// requires) are called out.                  [created date vs start date lead]
const withCalc = (rows) =>
  rows.map((d) => ({
    ...d,
    onTime: d.total - d.late,
    pct: Math.round((d.late / d.total) * 100),
    onTimePct: Math.round(((d.total - d.late) / d.total) * 100),
  }));

export const CREATED_WINDOWS = [
  { key: "1", label: "Past month" },
  { key: "3", label: "Past 3 months" },
  { key: "6", label: "Past 6 months" },
  { key: "12", label: "Past 12 months" },
];

// Keyed by lookback window. Each row: type, its planning horizon (months),
// total created in the window, and how many of those were created too late.
export const CREATED_TIMELINESS = {
  "1": withCalc([
    { type: "Major Theme", months: 12, total: 2, late: 1 },
    { type: "Initiative", months: 6, total: 11, late: 4 },
    { type: "Epic", months: 3, total: 31, late: 9 },
  ]),
  "3": withCalc([
    { type: "Major Theme", months: 12, total: 6, late: 1 },
    { type: "Initiative", months: 6, total: 28, late: 7 },
    { type: "Epic", months: 3, total: 84, late: 19 },
  ]),
  "6": withCalc([
    { type: "Major Theme", months: 12, total: 11, late: 2 },
    { type: "Initiative", months: 6, total: 52, late: 12 },
    { type: "Epic", months: 3, total: 150, late: 28 },
  ]),
  "12": withCalc([
    { type: "Major Theme", months: 12, total: 18, late: 4 },
    { type: "Initiative", months: 6, total: 86, late: 22 },
    { type: "Epic", months: 3, total: 240, late: 51 },
  ]),
};

// KPI-tile aggregate uses the full 12-month window.
const all12 = CREATED_TIMELINESS["12"];
export const CREATED_TOTAL = all12.reduce((a, d) => a + d.total, 0);
export const CREATED_LATE_TOTAL = all12.reduce((a, d) => a + d.late, 0);
export const ONTIME_PCT = Math.round(((CREATED_TOTAL - CREATED_LATE_TOTAL) / CREATED_TOTAL) * 100);

// ---- Orphaned work items: does the tree roll up to a Major Theme? -----------
// Child parent-links (Epic→Initiative, Story/Task→Epic, Subtask→Story/Task) are
// mandatory, so a missing OWN parent link can only occur at the entry gate
// (small). The big driver is CASCADE orphaning: an item's own parent links are
// intact, but an ancestor Initiative has no Major Theme, so the whole subtree
// never reaches the exec roll-up. The Major Theme link is new and not yet
// enforced, which is why orphaning is widespread.            [issue links]
export const ORPHANS = [
  { type: "Initiative", total: 86, orphan: 36, noParent: 36, cascade: 0, note: "No Major Theme link (not yet enforced)" },
  { type: "Epic", total: 240, orphan: 84, noParent: 6, cascade: 78 },
  { type: "User Story", total: 610, orphan: 232, noParent: 12, cascade: 220 },
  { type: "Task", total: 180, orphan: 70, noParent: 4, cascade: 66 },
  { type: "Bug", total: 150, orphan: 58, noParent: 3, cascade: 55 },
  { type: "Subtask", total: 220, orphan: 96, noParent: 4, cascade: 92 },
].map((d) => ({ ...d, pct: Math.round((d.orphan / d.total) * 100) }));
export const ORPHAN_WORKITEMS_TOTAL = ORPHANS.reduce((a, d) => a + d.orphan, 0);
// Issue types that can be orphaned (Major Theme is the root, so it's excluded).
export const ORPHAN_TYPES = ORPHANS.map((o) => o.type);

// (c) Status funnel — issues by status (SOP status-flow order), filterable by
// issue type. Each type's total is distributed across statuses by a typical
// profile, so counts (and their share of total) recompute per selection.
export const STATUS_ORDER = ["To Do", "Ready for work", "In progress", "Code review", "QA / Testing", "Ready for UAT", "In UAT Review", "Blocked", "Release sign off", "Done", "Released", "On hold", "Cancelled"];
const STATUS_META = {
  "To Do": { gate: true },
  "Ready for work": { gate: true },
  "In progress": { validate: true },
  "Blocked": { risk: "Red" },
  "On hold": { risk: "Amber" },
  "Cancelled": { risk: "Red" },
};
const STATUS_TYPE_TOTALS = { "Major Theme": 18, "Initiative": 86, "Epic": 240, "User Story": 610, "Task": 180, "Bug": 150, "Subtask": 220 };
// Relative status weights per type, aligned with STATUS_ORDER.
const STATUS_WEIGHTS = {
  "Major Theme": [22, 10, 28, 0, 0, 0, 0, 6, 0, 18, 10, 4, 2],
  "Initiative": [20, 10, 26, 0, 0, 0, 0, 6, 2, 18, 12, 4, 2],
  "Epic": [18, 10, 22, 4, 4, 2, 1, 4, 2, 16, 12, 3, 2],
  "User Story": [16, 12, 16, 5, 6, 3, 2, 3, 2, 16, 13, 2, 4],
  "Task": [18, 12, 18, 5, 4, 2, 1, 3, 2, 17, 12, 2, 4],
  "Bug": [20, 8, 18, 5, 8, 2, 1, 6, 1, 14, 9, 2, 6],
  "Subtask": [22, 8, 24, 4, 4, 1, 1, 3, 1, 20, 8, 2, 2],
};
// Distribute a total across weights, rounding to hit the exact total.
function distribute(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  const rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  for (let k = 0; k < rem; k++) out[order[k].i]++;
  return out;
}
const STATUS_BY_TYPE = {};
Object.keys(STATUS_TYPE_TOTALS).forEach((t) => {
  const counts = distribute(STATUS_TYPE_TOTALS[t], STATUS_WEIGHTS[t]);
  STATUS_BY_TYPE[t] = {};
  STATUS_ORDER.forEach((s, i) => { STATUS_BY_TYPE[t][s] = counts[i]; });
});

// Aggregate status counts over the selected issue types; also returns the total.
export function statusRows(selectedTypes) {
  const types = selectedTypes && selectedTypes.length ? selectedTypes : Object.keys(STATUS_TYPE_TOTALS);
  const rows = STATUS_ORDER.map((status) => {
    let count = 0;
    types.forEach((t) => { count += (STATUS_BY_TYPE[t] && STATUS_BY_TYPE[t][status]) || 0; });
    return { status, count, ...STATUS_META[status] };
  });
  const total = rows.reduce((a, r) => a + r.count, 0);
  return { rows, total };
}

// (d) Flow & aging risks — what a VALIDATED workflow still allows to go wrong
// (work stalls or holds valid-but-wrong values). Filterable by issue type;
// `% of total` is each count over the total issues of the selected types.
const FLOW_TYPE_ORDER = ["Major Theme", "Initiative", "Epic", "User Story", "Task", "Bug", "Subtask"];
const FLOW_RISK_DEFS = [
  { label: "Mandatory fields still to complete (To Do / Ready for Work)", total: GATE_STUCK, severity: "Amber", note: "Needed before the issue can move to In Progress", weights: [18, 86, 240, 610, 180, 150, 220] },
  { label: "Stale > 14 days, no update", total: STALE_TOTAL, severity: "Amber", note: "Status may no longer reflect reality", weights: [18, 86, 240, 610, 180, 150, 220] },
  { label: "In Progress > 30 days (aging WIP)", total: sumFlag("agingWip"), severity: "Amber", note: "Work-in-progress not moving", weights: [10, 50, 160, 360, 140, 120, 90] },
  { label: "Blocked > 30 days", total: BLOCKED_AGED, severity: "Red", note: "Long-lived blocker", weights: [6, 40, 120, 220, 90, 110, 40] },
  { label: "Open & past due date", total: 138, severity: "Red", note: "Due date in the past, not Done", weights: [8, 60, 160, 300, 120, 90, 0] },
  { label: "Oversized stories (> 8 story points)", total: OVERSIZED, severity: "Amber", note: "Valid value, but SOP says split", weights: [0, 0, 0, 80, 20, 0, 0] },
  { label: "On hold > 60 days", total: 14, severity: "Amber", note: "Parked work, not reviewed", weights: [1, 2, 4, 3, 2, 1, 1] },
];
FLOW_RISK_DEFS.forEach((r) => { r.byType = distribute(r.total, r.weights); });

// Aggregate flow/aging risks over selected issue types; `% of total` uses the
// total issues of those types as the denominator.
export function flowRisks(selectedTypes) {
  const types = selectedTypes && selectedTypes.length ? selectedTypes : FLOW_TYPE_ORDER;
  const idx = types.map((t) => FLOW_TYPE_ORDER.indexOf(t)).filter((i) => i >= 0);
  const totalIssues = idx.reduce((a, i) => a + STATUS_TYPE_TOTALS[FLOW_TYPE_ORDER[i]], 0);
  const rows = FLOW_RISK_DEFS.map((r) => {
    const count = idx.reduce((a, i) => a + r.byType[i], 0);
    return { label: r.label, severity: r.severity, note: r.note, count, pct: totalIssues ? Math.round((count / totalIssues) * 100) : 0 };
  });
  return { rows, totalIssues };
}

// ===== Q3: data you can trust ================================================
// Trust verdicts are enforcement-aware. Fields gated by the validator are
// trustworthy on active issues; the residual risks are the new Major Theme
// layer, staleness, and valid-but-wrong values.
export const TRUST_BY_METRIC = [
  { area: "RAG status", level: "good", basis: "Statuses are validator-enforced; only staleness (14%) erodes it", auto: "status" },
  { area: "OKR / Strategy mapping", level: "good", basis: "OKR mandatory to transition — present on all active initiatives & epics", auto: "field (gated)" },
  { area: "Investment / Capitalization", level: "good", basis: "Capitalizable enforced at the gate", auto: "field (gated)" },
  { area: "Dependencies", level: "good", basis: "Link type enforced when a link exists — active graph is complete", auto: "issue links (gated)" },
  { area: "Portfolio roles / families", level: "good", basis: "Product Subgroup enforced for active items", auto: "field (gated)" },
  { area: "Roadmap timeline", level: "caution", basis: "Dates present (enforced) but 11% of open items are past due, 14% stale", auto: "due / updated" },
  { area: "Velocity / Story points", level: "caution", basis: "SP present for active stories, but 8% exceed the 8-SP cap", auto: "story points" },
  { area: "Exec Major-Theme roll-up", level: "bad", basis: "Major Theme link not yet a validator — 42% of initiatives unlinked", auto: "issue links", isNew: true },
];

// Data-quality gaps — ONLY things the validators do not guarantee. Lower %
// is better. (We deliberately omit "missing OKR / subgroup / dates / link type"
// because, for active issues, the validator guarantees they're present.)
export const DQ_DIMENSIONS = [
  { dim: "Initiatives not linked to a Major Theme", pct: 42, affected: 36, scope: "of 86 initiatives", isNew: true, impact: "Exec roll-up & theme RAG incomplete", auto: "issue links" },
  { dim: "Stale issues (> 14 days, no update)", pct: 14, affected: STALE_TOTAL, scope: "of open issues", impact: "Status may not reflect reality", auto: "updated date" },
  { dim: "Open issues past their due date", pct: 11, affected: 138, scope: "of open issues", impact: "Timeline optimistic", auto: "due < today" },
  { dim: "Oversized stories (> 8 story points)", pct: 8, affected: OVERSIZED, scope: "of estimated stories", impact: "Velocity distorted", auto: "story points" },
  { dim: "Due date before start date", pct: 4, affected: 47, scope: "of dated issues", impact: "Internally inconsistent dates", auto: "due < start" },
  { dim: "Not started — fields incomplete (this quarter)", pct: 24, affected: GATE_STUCK, scope: "of this-quarter issues", impact: "Forward roadmap under-populated", auto: "status IN (To Do, Ready for Work)" },
];

// ===== Q4: trend over last 8 weekly snapshots ================================
// Snapshot a handful of JQL counts / % each week and store them — that's the
// only piece that needs a scheduled capture; every input is auto-pullable.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Build an n-point series ending exactly at `curr`, generally improving by `drift`.
function series(curr, drift, seed, n) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) { out.push(curr); continue; }
    out.push(Math.round(curr - drift + drift * (i / (n - 1)) + (r() - 0.5) * 4));
  }
  return out;
}
function monthLabels(endIso, n) {
  const end = new Date(endIso + "T00:00:00"), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end); d.setMonth(d.getMonth() - i);
    out.push(d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }));
  }
  return out;
}
const TREND_N = 12; // 12 monthly snapshots available
const TREND_LABELS = monthLabels(SNAPSHOT, TREND_N);
// One line per team-health metric: the four components + the overall score.
const TREND_KEYS = [
  { key: "Planning horizons", field: "planning", drift: 16, seed: 3 },
  { key: "Mandatory fields", field: "fields", drift: 13, seed: 7 },
  { key: "Status funnel", field: "workflow", drift: 10, seed: 11 },
  { key: "Flow & aging", field: "flow", drift: 12, seed: 21 },
  { key: "Overall health", field: "health", drift: 12, seed: 99 },
];
// Issue-weighted current value of a metric across the selected BUs (all if none).
function wavgBU(field, busArr) {
  const sel = busArr && busArr.length ? TEAMS.filter((t) => busArr.includes(t.bu)) : TEAMS;
  const tot = sel.reduce((a, t) => a + t.issues, 0) || 1;
  return Math.round(sel.reduce((a, t) => a + t.issues * t[field], 0) / tot);
}

export const TREND_KEYS_LIST = TREND_KEYS.map((t) => t.key);
export const TREND_WINDOWS = [
  { key: "3", label: "3 months", months: 3 },
  { key: "6", label: "6 months", months: 6 },
  { key: "12", label: "1 year", months: 12 },
];
// Chart rows for the last `months`, ending at the selected-BU current values.
export function trendData(months, busArr) {
  const byKey = {};
  TREND_KEYS.forEach((t) => { byKey[t.key] = series(wavgBU(t.field, busArr), t.drift, t.seed, TREND_N); });
  const rows = TREND_LABELS.map((period, i) => {
    const r = { period };
    TREND_KEYS.forEach((t) => { r[t.key] = byKey[t.key][i]; });
    return r;
  });
  return rows.slice(Math.max(0, rows.length - months));
}
// Per-metric cards over the window for the selected BUs: current + delta vs window start.
export function trendMetrics(months, busArr) {
  return TREND_KEYS.map((t) => {
    const full = series(wavgBU(t.field, busArr), t.drift, t.seed, TREND_N);
    const s = full.slice(Math.max(0, full.length - months));
    return { key: t.key, curr: full[full.length - 1], prev: s[0], series: s };
  });
}
