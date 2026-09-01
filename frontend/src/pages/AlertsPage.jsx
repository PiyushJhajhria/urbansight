import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Ban, Gauge, ShieldAlert } from "lucide-react";

import AlertCard from "../components/AlertCard";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useDashboard } from "../context/DashboardContext";

const FILTERS = [
  { id: "ALL", label: "All types" },
  { id: "BLACKLIST_MATCH", label: "Blacklist" },
  { id: "IMPOSSIBLE_SPEED", label: "Impossible speed" },
  { id: "RESTRICTED_ROUTE", label: "Restricted route" },
];

function AlertsPage() {
  const { alerts } = useDashboard();
  const [filter, setFilter] = useState("ALL");

  const counts = useMemo(() => {
    const tally = {
      BLACKLIST_MATCH: 0,
      IMPOSSIBLE_SPEED: 0,
      RESTRICTED_ROUTE: 0,
    };
    alerts.forEach((alert) => {
      if (tally[alert.type] != null) tally[alert.type] += 1;
    });
    return tally;
  }, [alerts]);

  const visible =
    filter === "ALL"
      ? alerts
      : alerts.filter((alert) => alert.type === filter);

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Security intelligence"
        title="Alerts & anomalies"
        description="Rendered from GET /alerts. Fields vary by type; missing properties are omitted instead of invented."
      />

      <div className="alert-summary-grid four">
        <div className="alert-summary-card">
          <AlertTriangle size={22} />
          <div>
            <span>Total alerts</span>
            <strong>{alerts.length}</strong>
          </div>
        </div>
        <div className="alert-summary-card tone-critical">
          <Ban size={22} />
          <div>
            <span>Blacklist</span>
            <strong>{counts.BLACKLIST_MATCH}</strong>
          </div>
        </div>
        <div className="alert-summary-card tone-high">
          <Gauge size={22} />
          <div>
            <span>Impossible speed</span>
            <strong>{counts.IMPOSSIBLE_SPEED}</strong>
          </div>
        </div>
        <div className="alert-summary-card tone-watch">
          <ShieldAlert size={22} />
          <div>
            <span>Restricted route</span>
            <strong>{counts.RESTRICTED_ROUTE}</strong>
          </div>
        </div>
      </div>

      <div className="map-toolbar">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "toolbar-chip active" : "toolbar-chip"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        <div className="alert-summary-card compact-status">
          <Activity size={16} />
          Monitoring
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Security feed</p>
            <h2>Alert list</h2>
          </div>
        </div>
        <div className="alert-list large-alert-list">
          {visible.length === 0 ? (
            <EmptyState
              title="No matching alerts"
              message={
                alerts.length === 0
                  ? "GET /alerts returned an empty list."
                  : "No alerts of this type in the current feed."
              }
            />
          ) : (
            visible.map((alert, index) => (
              <AlertCard key={`${alert.type}-${index}`} alert={alert} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default AlertsPage;
