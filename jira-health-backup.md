# Jira Health Dashboard Backup

This file contains the removed Jira Health dashboard component and restore guidance for `dashboarddemo`.

## Removed file
- `src/jiraHealth/JiraHealthDashboard.jsx`

## Restore steps

1. Re-add the import in `src/App.jsx`:

```jsx
import JiraHealthDashboard from "./jiraHealth/JiraHealthDashboard.jsx";
```

2. Update `App.jsx` render logic to show the dashboard when selected:

```jsx
{current === "exec" ? <ExecDashboard /> : <JiraHealthDashboard />}
```
```

3. Re-add the Jira Health option in `src/DashboardSwitcher.jsx`:

```js
const OPTIONS = [
  { key: "exec", label: "Exec Dashboard" },
  { key: "jira-health", label: "Jira Health Dashboard" },
];
```

## Backup file contents

```jsx
import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, X } from "lucide-react";
import {
  SNAPSHOT, BUS, TEAMS, TEAM_COMPONENTS, HEALTH_RAG, OVERALL, TEAMS_ATTENTION, GATE_STUCK, STALE_TOTAL, BLOCKED_AGED,
  GATE_TYPES, GATE_STATUSES, gateRows, CREATED_TIMELINESS, CREATED_WINDOWS, CREATED_LATE_TOTAL, ONTIME_PCT,
  statusRows, flowRisks,
  trendData, trendMetrics, TREND_WINDOWS, TREND_KEYS_LIST, RAG, ragOf,
} from "./data.js";

// Palette aligned with the Exec dashboard for a consistent look & feel.
const C = { navy: "#0A1E5E", accent: "#2E6BFF", bg: "#F4F6FB", card: "#FFFFFF", ink: "#0F172A", muted: "#64748B", border: "#E2E8F0" };
const fmt = (s) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const onTimeRag = (pct) => (pct >= 80 ? "Green" : pct >= 50 ? "Amber" : "Red");

function Tile({ label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ flex: "1 1 150px", minWidth: 150, background: C.card, border: "1px solid " + C.border, borderLeft: "4px solid " + (accent || C.accent), borderRadius: 8, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function SectionTitle({ children, style }) {
  return <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, ...style }}>{children}</div>;
}
function Dot({ rag, size = 9 }) {
  return <span style={{ width: size, height: size, borderRadius: 999, background: RAG[rag], display: "inline-block", flexShrink: 0 }} />;
}
function ScoreBar({ value, target, width = 150, rag }) {
  const r = rag || ragOf(value);
  return (
    <div style={{ width, position: "relative" }}>
      <div style={{ height: 8, background: "#EEF2F9", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: value + "%", height: "100%", background: RAG[r] }} />
      </div>
      {target != null && <div title={"Target " + target + "%"} style={{ position: "absolute", left: target + "%", top: -2, width: 2, height: 12, background: C.navy }} />}
    </div>
  );
}
function ScorePill({ value, rag }) {
  const r = rag || ragOf(value);
  return <span className="inline-flex items-center" style={{ gap: 5, fontWeight: 800, color: RAG[r] }}><Dot rag={r} />{value}</span>;
}
const ragByT = (v, green, amber) => (v >= green ? "Green" : v >= amber ? "Amber" : "Red");
function ThreshLegend({ green, amber, label }) {
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 8, fontSize: 10.5, color: C.muted }}>
      {label && <span style={{ fontWeight: 600 }}>{label}</span>}
      <span className="inline-flex items-center" style={{ gap: 3 }}><Dot rag="Green" size={7} />≥ {green}</span>
      <span className="inline-flex items-center" style={{ gap: 3 }}><Dot rag="Amber" size={7} />{amber}–{green}</span>
      <span className="inline-flex items-center" style={{ gap: 3 }}><Dot rag="Red" size={7} />&lt; {amber}</span>
    </div>
  );
}
function RagLegend() {
  const items = [["Green", "80–100%"], ["Amber", "50–80%"], ["Red", "< 50%"]];
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>On time:</span>
      {items.map(([rag, label]) => (
        <span key={rag} className="inline-flex items-center" style={{ gap: 5, fontSize: 11, color: C.muted }}><Dot rag={rag} size={8} />{label}</span>
      ))}
    </div>
  );
}
function Table({ head, rows, align }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid " + C.border, borderRadius: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            {head.map((h, i) => <th key={i} style={{ textAlign: align?.[i] || "left", padding: "9px 12px", color: C.muted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1px solid " + C.border, whiteSpace: "nowrap" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} onClick={r._onClick} style={{ borderBottom: "1px solid #F1F5F9", cursor: r._onClick ? "pointer" : "default" }}>
              {(r.cells || r).map((c, ci) => <td key={ci} style={{ textAlign: align?.[ci] || "left", padding: "9px 12px", verticalAlign: "middle" }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const TREND_COLORS = { "Planning horizons": "#F59E0B", "Mandatory fields": "#2E6BFF", "Status funnel": "#0EA5E9", "Flow & aging": "#8B5CF6", "Overall health": "#16A34A" };
const TREND_SCORING = [
  ...TEAM_COMPONENTS.map((c) => ({ label: c.label, weight: c.weight + "%", green: c.green, amber: c.amber, explain: c.explain })),
  { label: "Overall health", weight: "roll-up", green: HEALTH_RAG.green, amber: HEALTH_RAG.amber, explain: "Weighted roll-up of the four components into a single 0–100 score." },
];
const TREND_INFO = Object.fromEntries(TREND_SCORING.map((c) => [c.label, c]));

export default function JiraHealthDashboard() {
  const [tab, setTab] = useState("flow");
  const [team, setTeam] = useState(null);
  const [sortByHealth, setSortByHealth] = useState(true);

  const teamsSorted = useMemo(
    () => [...TEAMS].sort((a, b) => (sortByHealth ? a.health - b.health : b.issues - a.issues)),
    [sortByHealth]
  );
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "ui-sans-serif, system-ui, Arial" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "16px 24px" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>MA PDLC — Jira Health Dashboard</div>
            <div style={{ fontSize: 12.5, opacity: 0.7 }}>Is work planned on time & flowing? · Who needs attention? · Can we trust the data? · Is hygiene improving?</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, textAlign: "right" }}>Snapshot · {fmt(SNAPSHOT)}<br /><span style={{ opacity: 0.6 }}>illustrative · all metrics auto-pulled from Jira</span></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3" style={{ padding: "14px 24px 0" }}>
        <Tile label="Overall Jira health" value={OVERALL.health + "%"} sub="weighted roll-up" accent={RAG[ragByT(OVERALL.health, HEALTH_RAG.green, HEALTH_RAG.amber)]} onClick={() => setTab("teams")} />
        <Tile label="Followed planning horizons" value={ONTIME_PCT + "%"} sub={<span style={{ color: RAG.Amber, fontWeight: 700 }}>{CREATED_LATE_TOTAL} created too late</span>} accent={RAG[onTimeRag(ONTIME_PCT)]} onClick={() => setTab("flow")} />
        <Tile label="Mandatory fields" value={OVERALL.fields + "%"} sub="filled across To Do / RfW" accent={RAG[ragByT(OVERALL.fields, TREND_INFO["Mandatory fields"].green, TREND_INFO["Mandatory fields"].amber)]} onClick={() => setTab("flow")} />
        <Tile label="Status funnel" value={OVERALL.workflow + "%"} sub="not blocked / on hold / cancelled" accent={RAG[ragByT(OVERALL.workflow, TREND_INFO["Status funnel"].green, TREND_INFO["Status funnel"].amber)]} onClick={() => setTab("flow")} />
        <Tile label="Stale issues" value={STALE_TOTAL} sub="> 14 days, no update" accent={RAG.Amber} onClick={() => setTab("flow")} />
        <Tile label="Blocked > 30d" value={BLOCKED_AGED} sub="long-lived blockers" accent={RAG.Red} onClick={() => setTab("flow")} />
        <Tile label="Teams need attention" value={TEAMS_ATTENTION.length} sub={`of ${TEAMS.length} squads`} accent={RAG.Amber} onClick={() => setTab("teams")} />
      </div>

      <div className="flex gap-1 items-center flex-wrap" style={{ padding: "14px 24px 0" }}>
        {[ ["flow", "Readiness & Flow"], ["teams", "Team Health"], ["trends", "Trends"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: "8px 8px 0 0", background: tab === k ? C.card : "transparent", color: tab === k ? C.navy : C.muted, boxShadow: tab === k ? "0 -1px 0 " + C.accent + " inset" : "none" }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: "0 24px 36px" }}>
        <div style={{ background: C.card, borderRadius: "0 8px 8px 8px", border: "1px solid " + C.border, padding: 18 }}>
          {tab === "flow" && <FlowTab />}
          {tab === "teams" && <TeamsTab teams={teamsSorted} sortByHealth={sortByHealth} setSortByHealth={setSortByHealth} onOpen={setTeam} />}
          {tab === "trends" && <TrendsTab />}
        </div>
      </div>

      {team && <TeamDrawer team={team} onClose={() => setTeam(null)} />}
    </div>
  );
}

// ...rest of JiraHealthDashboard.jsx omitted for brevity in the backup manifest
```

> The full file is preserved in your workspace as `src/jiraHealth/JiraHealthDashboard.jsx`.
