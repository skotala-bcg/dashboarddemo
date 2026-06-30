import { useState } from "react";
import ExecDashboard from "./ExecDashboard.jsx";
import JiraHealthDashboard from "./jiraHealth/JiraHealthDashboard.jsx";
import DashboardSwitcher from "./DashboardSwitcher.jsx";

export default function App() {
  const [current, setCurrent] = useState("exec");
  return (
    <div>
      <header style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "12px 24px" }}>
        <DashboardSwitcher current={current} onChange={setCurrent} />
      </header>
      {current === "exec" ? <ExecDashboard /> : <JiraHealthDashboard />}
    </div>
  );
}
