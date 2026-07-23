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
// On-time % colour thresholds for Planning Horizon Adherence (legend: 50 / 80 / 100).
const onTimeRag = (pct) => (pct >= 80 ? "Green" : pct >= 50 ? "Amber" : "Red");

// ---- shared primitives ------------------------------------------------------
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
// RAG from explicit per-metric thresholds.
const ragByT = (v, green, amber) => (v >= green ? "Green" : v >= amber ? "Amber" : "Red");
// Compact RAG legend for a metric's thresholds.
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
// Legend for the on-time RAG colour coding (matches ragOf thresholds).
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
// Scoring + RAG-threshold info per trend metric (the 4 components + overall health).
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
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Test - Jira Health</div>
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
        {[["flow", "Readiness & Flow"], ["teams", "Team Health"], ["trends", "Trends"]].map(([k, l]) => (
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

// ===== Q1: Readiness & Flow ==================================================
function FlowTab() {
  const [win, setWin] = useState("3");
  const [statusTypes, setStatusTypes] = useState(new Set(GATE_TYPES));
  const { rows: statusData, total: statusTotal } = statusRows([...statusTypes]);
  const maxStatus = Math.max(1, ...statusData.map((s) => s.count));
  const allStatusTypesActive = statusTypes.size === GATE_TYPES.length;
  const toggleStatusType = (t) => setStatusTypes((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n.size === 0 ? new Set([GATE_TYPES[0]]) : n; });
  const [flowTypes, setFlowTypes] = useState(new Set(GATE_TYPES));
  const { rows: flowData } = flowRisks([...flowTypes]);
  const allFlowTypesActive = flowTypes.size === GATE_TYPES.length;
  const toggleFlowType = (t) => setFlowTypes((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n.size === 0 ? new Set([GATE_TYPES[0]]) : n; });
  const [gateTypes, setGateTypes] = useState(new Set(GATE_TYPES));
  const [gateStatuses, setGateStatuses] = useState(new Set(GATE_STATUSES));
  const gateData = gateRows([...gateTypes], [...gateStatuses]);
  const maxGate = Math.max(1, ...gateData.map((g) => g.missing));
  const allTypesActive = gateTypes.size === GATE_TYPES.length;
  const allStatusesActive = gateStatuses.size === GATE_STATUSES.length;
  const chipStyle = (active) => ({ border: "1px solid " + (active ? C.accent : C.border), background: active ? C.accent + "14" : "#fff", color: active ? C.accent : C.muted, borderRadius: 14, padding: "3px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" });
  const toggleType = (t) => setGateTypes((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n.size === 0 ? new Set([GATE_TYPES[0]]) : n; });
  const toggleStatus = (s) => setGateStatuses((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n.size === 0 ? new Set([GATE_STATUSES[0]]) : n; });
  return (
    <>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10, marginBottom: 8 }}>
        <SectionTitle style={{ marginBottom: 0 }}>Are issues planned according to planning horizons?</SectionTitle>
        <div className="flex items-center flex-wrap" style={{ gap: 16 }}>
          <RagLegend />
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>Created in:</span>
            <div className="flex" style={{ border: "1px solid " + C.border, borderRadius: 7, overflow: "hidden" }}>
              {CREATED_WINDOWS.map((w) => (
                <button key={w.key} onClick={() => setWin(w.key)} style={{ border: "none", cursor: "pointer", padding: "5px 11px", fontSize: 11.5, fontWeight: 700, background: win === w.key ? C.navy : "#fff", color: win === w.key ? "#fff" : C.muted }}>{w.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 14px" }}>
        Each level should be created with enough lead time before its work begins — a Major Theme about 12 months ahead, Initiatives 6, and Epics 3 (items below an Epic are planned within the sprint). The cards show how much was created on time, with anything created too late called out. Switch the window to look across different time frames.
      </p>
      <div className="flex flex-wrap" style={{ gap: 14, marginBottom: 22 }}>
        {CREATED_TIMELINESS[win].map((d) => {
          const onRag = onTimeRag(d.onTimePct);
          return (
            <div key={d.type} style={{ flex: "1 1 250px", border: "1px solid " + C.border, borderLeft: "4px solid " + RAG[onRag], borderRadius: 8, padding: 14 }}>
              <div className="flex items-start justify-between" style={{ gap: 10 }}>
                <div>
                  <b style={{ fontSize: 13.5 }}>{d.type}</b>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{d.months}-month horizon</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: RAG[onRag] }}>{d.onTimePct}% created on time ({d.onTime}/{d.total})</div>
                  <div style={{ fontSize: 11.5, color: RAG.Red, fontWeight: 700, marginTop: 2 }}>{d.late} created late</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}><ScoreBar value={d.onTimePct} width={"100%"} rag={onRag} /></div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Which mandatory fields still need completing?</SectionTitle>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 10px" }}>
        It's normal for issues to sit in <i>To Do</i> or <i>Ready for Work</i> while they're being refined — they simply haven't started yet. The mandatory fields only need to be in place before an issue moves to <i>In Progress</i>. Across those {GATE_STUCK} not-yet-started issues, this is which mandatory fields are still to be filled in, so teams know what's left to complete.
      </p>
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, width: 64 }}>Issue type:</span>
        <button onClick={() => setGateTypes(allTypesActive ? new Set([GATE_TYPES[0]]) : new Set(GATE_TYPES))} style={chipStyle(allTypesActive)}>All</button>
        {GATE_TYPES.map((t) => (
          <button key={t} onClick={() => toggleType(t)} style={chipStyle(gateTypes.has(t))}>{t}</button>
        ))}
      </div>
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, width: 64 }}>Status:</span>
        <button onClick={() => setGateStatuses(allStatusesActive ? new Set([GATE_STATUSES[0]]) : new Set(GATE_STATUSES))} style={chipStyle(allStatusesActive)}>All</button>
        {GATE_STATUSES.map((s) => (
          <button key={s} onClick={() => toggleStatus(s)} style={chipStyle(gateStatuses.has(s))}>{s}</button>
        ))}
      </div>
      {gateData.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: C.muted, border: "1px solid " + C.border, borderRadius: 8 }}>Select an issue type above to see its mandatory fields.</div>
      ) : (
        <Table
          head={["Mandatory field", "Still to complete", "", "Applies to (out of selected issues)"]}
          align={[null, "right", null, null]}
          rows={gateData.map((g) => [
            <b>{g.field}</b>,
            <span style={{ whiteSpace: "nowrap" }}><b style={{ color: C.ink }}>{g.missing}</b><span style={{ color: C.muted, fontWeight: 400 }}> / {g.applicable}</span> <span style={{ color: C.muted }}>({g.pct}% left)</span></span>,
            <div style={{ width: 160, background: "#F1F5F9", borderRadius: 4, overflow: "hidden", height: 10 }}><div style={{ width: (g.missing / maxGate) * 100 + "%", height: "100%", background: C.accent }} /></div>,
            <span style={{ color: C.muted }}>{g.types}{g.note ? <span style={{ color: "#94A3B8" }}> · {g.note}</span> : null}</span>,
          ])}
        />
      )}

      <div className="flex flex-wrap items-stretch" style={{ gap: 56, marginTop: 24 }}>
        <div style={{ flex: "1 1 340px", border: "1px solid " + C.border, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column" }}>
          <SectionTitle>Status funnel</SectionTitle>
          <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 10px", minHeight: 34 }}>Issues across the SOP status flow.</p>
          <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, width: 64 }}>Issue type:</span>
            <button onClick={() => setStatusTypes(allStatusTypesActive ? new Set([GATE_TYPES[0]]) : new Set(GATE_TYPES))} style={chipStyle(allStatusTypesActive)}>All</button>
            {GATE_TYPES.map((t) => (
              <button key={t} onClick={() => toggleStatusType(t)} style={chipStyle(statusTypes.has(t))}>{t}</button>
            ))}
          </div>
          <div className="flex items-center" style={{ gap: 8, marginBottom: 4, fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
            <div style={{ width: 130, flexShrink: 0, textAlign: "right" }}>Status</div>
            <div style={{ flex: 1 }} />
            <div style={{ width: 40, flexShrink: 0, textAlign: "right" }}>Issues</div>
            <div style={{ width: 72, flexShrink: 0, textAlign: "right" }}>% of selected types</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {statusData.map((s) => {
            const pct = statusTotal ? Math.round((s.count / statusTotal) * 100) : 0;
            const barColor = s.risk ? RAG[s.risk] : s.gate ? C.navy : C.accent;
            const labelColor = s.gate ? C.navy : s.validate ? C.accent : s.risk ? RAG[s.risk] : C.muted;
            return (
              <div key={s.status} className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
                <div style={{ width: 130, fontSize: 11.5, color: labelColor, fontWeight: s.gate || s.validate || s.risk ? 700 : 400, textAlign: "right", flexShrink: 0 }}>{s.status}{s.gate ? " ⛳" : s.validate ? " 🔒" : ""}</div>
                <div style={{ flex: 1, background: "#F1F5F9", borderRadius: 4, overflow: "hidden", height: 16 }}>
                  <div style={{ width: (s.count / maxStatus) * 100 + "%", height: "100%", background: barColor }} />
                </div>
                <div style={{ width: 40, fontSize: 11.5, fontWeight: 700, flexShrink: 0, textAlign: "right" }}>{s.count}</div>
                <div style={{ width: 72, fontSize: 11.5, color: C.muted, flexShrink: 0, textAlign: "right" }}>{pct}%</div>
              </div>
            );
          })}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>⛳ before start (To Do / Ready for Work) — where mandatory-field gaps live · 🔒 field validator fires on the move to In Progress.</div>
        </div>
        <div style={{ flex: "1 1 340px", border: "1px solid " + C.border, borderRadius: 8, padding: 16 }}>
          <SectionTitle>Flow & aging risks</SectionTitle>
          <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 10px", minHeight: 34 }}>What a validated workflow still allows to go wrong — work stalls or holds valid-but-wrong values.</p>
          <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, width: 64 }}>Issue type:</span>
            <button onClick={() => setFlowTypes(allFlowTypesActive ? new Set([GATE_TYPES[0]]) : new Set(GATE_TYPES))} style={chipStyle(allFlowTypesActive)}>All</button>
            {GATE_TYPES.map((t) => (
              <button key={t} onClick={() => toggleFlowType(t)} style={chipStyle(flowTypes.has(t))}>{t}</button>
            ))}
          </div>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 4, fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
            <div style={{ flex: 1 }}>Risk</div>
            <div style={{ width: 44, textAlign: "right" }}>Issues</div>
            <div style={{ width: 72, textAlign: "right" }}>% of selected types</div>
          </div>
          {flowData.map((v) => (
            <div key={v.label} className="flex items-center" style={{ gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span className="flex items-start" style={{ gap: 7, flex: 1 }}>
                <Dot rag={v.severity} size={9} />
                <span style={{ fontSize: 12.5 }}>
                  {v.label}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{v.note}</div>
                </span>
              </span>
              <b style={{ width: 44, fontSize: 15, color: RAG[v.severity], flexShrink: 0, textAlign: "right" }}>{v.count}</b>
              <span style={{ width: 72, fontSize: 11.5, color: C.muted, flexShrink: 0, textAlign: "right" }}>{v.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ===== Q2: Which teams need attention? =======================================
function TeamsTab({ teams, sortByHealth, setSortByHealth, onOpen }) {
  const healthRag = (v) => ragByT(v, HEALTH_RAG.green, HEALTH_RAG.amber);
  const attention = teams.filter((t) => t.health < HEALTH_RAG.green);
  const [query, setQuery] = useState("");
  const [bus, setBus] = useState(new Set(BUS));
  const allBusActive = bus.size === BUS.length;
  const chipStyle = (active) => ({ border: "1px solid " + (active ? C.accent : C.border), background: active ? C.accent + "14" : "#fff", color: active ? C.accent : C.muted, borderRadius: 14, padding: "3px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" });
  const toggleBu = (b) => setBus((prev) => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n.size === 0 ? new Set([BUS[0]]) : n; });
  const q = query.trim().toLowerCase();
  const filtered = teams.filter((t) => bus.has(t.bu) && (!q || t.id.toLowerCase().includes(q)));
  return (
    <>
      <SectionTitle>How team Jira health is scored</SectionTitle>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 12px" }}>
        Each squad's health rolls the four checks from the Readiness &amp; Flow view into a single 0–100 score, using the weights shown — each metric carries its own RAG thresholds. Click any team for its breakdown.
      </p>
      <div className="flex flex-wrap gap-3" style={{ marginBottom: 24 }}>
        {TEAM_COMPONENTS.map((c) => (
          <div key={c.key} style={{ flex: "1 1 240px", border: "1px solid " + C.border, borderRadius: 8, padding: 12 }}>
            <div className="flex items-center justify-between gap-2">
              <b style={{ fontSize: 13 }}>{c.label}</b>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accent + "14", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>{c.weight}% weight</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{c.explain}</div>
            <div style={{ marginTop: 8 }}><ThreshLegend green={c.green} amber={c.amber} /></div>
          </div>
        ))}
      </div>

      <SectionTitle>Teams needing attention</SectionTitle>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 12px" }}>Squads below a healthy score ({"<"}{HEALTH_RAG.green}), ranked worst-first — with the weakest of the four components called out.</p>
      <div className="flex flex-wrap gap-3" style={{ marginBottom: 24 }}>
        {attention.slice(0, 6).map((t) => {
          const dims = TEAM_COMPONENTS.map((c) => ({ label: c.label, val: t[c.key], rag: ragByT(t[c.key], c.green, c.amber) }));
          const worst = dims.reduce((a, b) => (b.val < a.val ? b : a));
          const hr = healthRag(t.health);
          return (
            <div key={t.id} onClick={() => onOpen(t)} style={{ width: 270, border: "1px solid " + C.border, borderLeft: "4px solid " + RAG[hr], borderRadius: 8, padding: 12, cursor: "pointer" }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontWeight: 700, fontSize: 13 }}>{t.id}</span>
                <ScorePill value={t.health} rag={hr} />
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{t.issues} issues · weakest: <b style={{ color: RAG[worst.rag] }}>{worst.label} {worst.val}</b></div>
              <div className="flex items-center" style={{ gap: 6, marginTop: 10, fontSize: 11, color: C.muted }}>
                <AlertTriangle size={13} color={RAG.Amber} /> {t.flags.gateBacklog} field gaps · {t.flags.stale} stale · {t.flags.createdLate} created late
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
        <SectionTitle>Team Jira-health scorecard</SectionTitle>
        <div className="flex items-center flex-wrap" style={{ gap: 16 }}>
          <ThreshLegend label="Health:" green={HEALTH_RAG.green} amber={HEALTH_RAG.amber} />
          <div className="flex" style={{ border: "1px solid " + C.border, borderRadius: 7, overflow: "hidden" }}>
            {[[true, "By health"], [false, "By volume"]].map(([v, l]) => (
              <button key={l} onClick={() => setSortByHealth(v)} style={{ border: "none", cursor: "pointer", padding: "5px 12px", fontSize: 11.5, fontWeight: 700, background: sortByHealth === v ? C.navy : "#fff", color: sortByHealth === v ? "#fff" : C.muted }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team…" style={{ border: "1px solid " + C.border, borderRadius: 7, padding: "6px 10px", fontSize: 12.5, width: 200, outline: "none", color: C.ink }} />
        <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginLeft: 4 }}>BU:</span>
        <button onClick={() => setBus(allBusActive ? new Set([BUS[0]]) : new Set(BUS))} style={chipStyle(allBusActive)}>All</button>
        {BUS.map((b) => (
          <button key={b} onClick={() => toggleBu(b)} style={chipStyle(bus.has(b))}>{b}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: C.muted, border: "1px solid " + C.border, borderRadius: 8 }}>No teams match your search / filter.</div>
      ) : (
      <Table
        head={["Team (BU – Squad)", "Issues", ...TEAM_COMPONENTS.map((c) => c.label), <span style={{ color: C.navy, fontWeight: 800 }}>Health</span>]}
        align={[null, "right", ...TEAM_COMPONENTS.map(() => "right"), "right"]}
        rows={filtered.map((t) => ({
          _onClick: () => onOpen(t),
          cells: [
            <span style={{ fontWeight: 600 }}>{t.id}</span>,
            t.issues,
            ...TEAM_COMPONENTS.map((c) => <ScorePill value={t[c.key]} rag={ragByT(t[c.key], c.green, c.amber)} />),
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 42, fontWeight: 800, fontSize: 14, color: "#fff", background: RAG[healthRag(t.health)], borderRadius: 6, padding: "5px 10px" }}>{t.health}</span>,
          ],
        }))}
      />
      )}
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Health = 20% Planning horizons · 30% Mandatory fields · 25% Status funnel · 25% Flow &amp; aging. Click a row for the breakdown.</div>
    </>
  );
}

// ===== Q3: Trends ============================================================
function TrendsTab() {
  const [win, setWin] = useState("6");
  const [bus, setBus] = useState(new Set(BUS));
  const allBusActive = bus.size === BUS.length;
  const chipStyle = (active) => ({ border: "1px solid " + (active ? C.accent : C.border), background: active ? C.accent + "14" : "#fff", color: active ? C.accent : C.muted, borderRadius: 14, padding: "3px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" });
  const toggleBu = (b) => setBus((prev) => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n.size === 0 ? new Set([BUS[0]]) : n; });
  const months = TREND_WINDOWS.find((w) => w.key === win).months;
  const busArr = [...bus];
  const data = trendData(months, busArr);
  const metrics = trendMetrics(months, busArr);
  return (
    <>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10, marginBottom: 4 }}>
        <SectionTitle style={{ marginBottom: 0 }}>Jira health over time</SectionTitle>
        <div className="flex items-center" style={{ gap: 6 }}>
          <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>Time frame:</span>
          <div className="flex" style={{ border: "1px solid " + C.border, borderRadius: 7, overflow: "hidden" }}>
            {TREND_WINDOWS.map((w) => (
              <button key={w.key} onClick={() => setWin(w.key)} style={{ border: "none", cursor: "pointer", padding: "5px 12px", fontSize: 11.5, fontWeight: 700, background: win === w.key ? C.navy : "#fff", color: win === w.key ? "#fff" : C.muted }}>{w.label}</button>
            ))}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 10px" }}>Monthly snapshots of the four team-health components and the overall score through {fmt(SNAPSHOT)}. Delta shown vs the start of the window.</p>
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>BU:</span>
        <button onClick={() => setBus(allBusActive ? new Set([BUS[0]]) : new Set(BUS))} style={chipStyle(allBusActive)}>All</button>
        {BUS.map((b) => (
          <button key={b} onClick={() => toggleBu(b)} style={chipStyle(bus.has(b))}>{b}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3" style={{ marginBottom: 18 }}>
        {metrics.map((m) => {
          const info = TREND_INFO[m.key];
          const d = m.curr - m.prev;
          const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
          const col = d > 0 ? RAG.Green : d < 0 ? RAG.Red : C.muted;
          return (
            <div key={m.key} style={{ flex: "1 1 240px", minWidth: 220, border: "1px solid " + C.border, borderTop: "3px solid " + TREND_COLORS[m.key], borderRadius: 8, padding: "10px 12px" }}>
              <div className="flex items-center justify-between gap-2">
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{m.key}</div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.accent, background: C.accent + "14", borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap" }}>{info.weight}</span>
              </div>
              <div className="flex items-end justify-between" style={{ marginTop: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: RAG[ragByT(m.curr, info.green, info.amber)] }}>{m.curr}%</div>
                <span className="flex items-center" style={{ gap: 3, color: col, fontWeight: 700, fontSize: 12.5 }}><Icon size={14} />{d > 0 ? "+" : ""}{d} pts</span>
              </div>
              <Sparkline data={m.series} color={TREND_COLORS[m.key]} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{info.explain}</div>
              <div style={{ marginTop: 8 }}><ThreshLegend green={info.green} amber={info.amber} /></div>
            </div>
          );
        })}
      </div>

      <div style={{ width: "100%", height: 340, border: "1px solid " + C.border, borderRadius: 8, padding: "14px 14px 4px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F9" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: C.muted }} />
            <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: C.muted }} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid " + C.border }} />
            {TREND_KEYS_LIST.map((k) => (
              <Line key={k} type="monotone" dataKey={k} stroke={TREND_COLORS[k]} strokeWidth={k === "Overall health" ? 3.5 : 2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap" style={{ gap: 16, marginTop: 10 }}>
        {TREND_KEYS_LIST.map((k) => (
          <span key={k} className="flex items-center" style={{ gap: 6, fontSize: 12, color: C.muted }}><span style={{ width: 14, height: k === "Overall health" ? 4 : 3, background: TREND_COLORS[k], borderRadius: 2 }} />{k}</span>
        ))}
      </div>

    </>
  );
}

function Sparkline({ data, color }) {
  const w = 150, h = 28, min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 4) - 2}`).join(" ");
  return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 6 }}><polyline points={pts} fill="none" stroke={color} strokeWidth={2} /></svg>;
}

// ---- Q2 drilldown drawer ----------------------------------------------------
function TeamDrawer({ team, onClose }) {
  const dims = TEAM_COMPONENTS.map((c) => ({ label: `${c.label} (${c.weight}%)`, val: team[c.key], note: c.explain, rag: ragByT(team[c.key], c.green, c.amber), green: c.green, amber: c.amber }));
  const hr = ragByT(team.health, HEALTH_RAG.green, HEALTH_RAG.amber);
  const f = team.flags;
  const flagRows = [
    ["Created too late (horizon items)", f.createdLate],
    ["Fields incomplete (To Do / Ready for Work)", f.gateBacklog],
    ["Stale > 14 days", f.stale],
    ["In Progress > 30 days", f.agingWip],
    ["Blocked > 30 days", f.blockedAged],
    ["Oversized stories (> 8 SP)", f.oversized],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,0.35)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "92vw", background: "#fff", boxShadow: "-8px 0 30px rgba(0,0,0,0.18)", overflowY: "auto" }}>
        <div style={{ background: C.navy, color: "#fff", padding: "16px 18px" }} className="flex items-start justify-between">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{team.id}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{team.issues} issues tracked · {team.flags.initiatives} initiatives</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>Overall Jira health</span>
            <span className="inline-flex items-center" style={{ gap: 8, fontSize: 26, fontWeight: 800, color: RAG[hr] }}><Dot rag={hr} size={12} />{team.health}</span>
          </div>
          <div style={{ marginBottom: 12 }}><ThreshLegend label="Health RAG:" green={HEALTH_RAG.green} amber={HEALTH_RAG.amber} /></div>
          {dims.map((d) => (
            <div key={d.label} style={{ marginBottom: 12 }}>
              <div className="flex items-center justify-between"><span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.label}</span><ScorePill value={d.val} rag={d.rag} /></div>
              <div style={{ margin: "4px 0 3px" }}><ScoreBar value={d.val} width={"100%"} rag={d.rag} /></div>
              <div style={{ fontSize: 11, color: C.muted }}>{d.note}</div>
              <div style={{ marginTop: 4 }}><ThreshLegend green={d.green} amber={d.amber} /></div>
            </div>
          ))}
          <SectionTitle style={{ marginTop: 18, fontSize: 13 }}>Open hygiene issues</SectionTitle>
          <div style={{ fontSize: 11, color: C.muted, margin: "2px 0 6px" }}>All counts auto-pulled from Jira status, changelog and issue links.</div>
          <div>
            {flagRows.map(([label, n]) => (
              <div key={label} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid #F1F5F9", fontSize: 12.5 }}>
                <span style={{ color: C.muted }}>{label}</span>
                <b style={{ color: n > 0 ? C.ink : "#CBD5E1" }}>{n}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
