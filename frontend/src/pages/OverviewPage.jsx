import {
  AlertTriangle,
  Camera,
  Car,
  Gauge,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AlertCard from "../components/AlertCard";
import CityMap from "../components/CityMap";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import TrajectoryRow from "../components/TrajectoryRow";
import { useDashboard } from "../context/DashboardContext";

function OverviewPage({ onNavigate }) {
  const {
    metrics,
    alerts,
    trajectories,
    counts,
    speeds,
    odFlows,
    heatmap,
  } = useDashboard();

  const countChart = counts.map((item) => ({
    name: item.camera_id,
    vehicles: Number(item.vehicle_count || 0),
  }));

  const speedChart = speeds.map((item) => ({
    name: `${item.from_camera}→${item.to_camera}`,
    speed: Number(item.average_speed_kmph || 0),
  }));

  const odChart = odFlows.map((item) => ({
    name: `${item.origin}→${item.destination}`,
    vehicles: Number(item.vehicle_count || 0),
  }));

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Executive overview"
        title="City operations snapshot"
        description="Live metrics from FastAPI analytics: unique plates, camera activity, segment speeds, and alerts."
      />

      <div className="stats-grid">
        <StatCard
          title="Vehicles detected"
          value={metrics.totalVehicles}
          subtitle="Unique plates reconstructed from trajectories"
          icon={Car}
          tone="blue"
        />
        <StatCard
          title="Active cameras"
          value={metrics.activeCameras}
          subtitle="Nodes present in analytics feeds"
          icon={Camera}
          tone="cyan"
        />
        <StatCard
          title="Average speed"
          value={`${metrics.averageSpeed} km/h`}
          subtitle="Mean of camera-to-camera segments"
          icon={Gauge}
          tone="green"
        />
        <StatCard
          title="Active alerts"
          value={metrics.activeAlerts}
          subtitle="Blacklist, speed, and route anomalies"
          icon={AlertTriangle}
          tone="red"
        />
      </div>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">City network</p>
              <h2>Map preview</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => onNavigate("map")}
            >
              Open live map
            </button>
          </div>
          {heatmap.length === 0 && trajectories.length === 0 ? (
            <EmptyState
              title="No geospatial data"
              message="Heatmap or trajectory coordinates were not returned by the backend."
            />
          ) : (
            <CityMap
              heatmap={heatmap}
              trajectories={trajectories.slice(0, 8)}
              height={320}
              showTrajectories={false}
            />
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Threat monitor</p>
              <h2>Recent alerts</h2>
            </div>
            <span className="alert-count">{alerts.length}</span>
          </div>
          <div className="alert-list">
            {alerts.length === 0 ? (
              <EmptyState title="No alerts" message="The alerts feed is empty." />
            ) : (
              alerts.slice(0, 4).map((alert, index) => (
                <AlertCard key={`${alert.type}-${index}`} alert={alert} compact />
              ))
            )}
          </div>
          {alerts.length > 0 ? (
            <button className="full-button" type="button" onClick={() => onNavigate("alerts")}>
              View all alerts
            </button>
          ) : null}
        </div>
      </section>

      <section className="chart-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Camera load</p>
              <h2>Unique vehicles per camera</h2>
            </div>
          </div>
          {countChart.length === 0 ? (
            <EmptyState
              title="No count data"
              message="GET /analytics/counts returned no rows."
            />
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countChart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7a94" tick={{ fill: "#8b98b0", fontSize: 11 }} />
                  <YAxis stroke="#6b7a94" tick={{ fill: "#8b98b0", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1220",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                    }}
                  />
                  <Bar dataKey="vehicles" fill="#4c7dff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Segment speeds</p>
              <h2>Average speed (km/h)</h2>
            </div>
          </div>
          {speedChart.length === 0 ? (
            <EmptyState
              title="No speed data"
              message="GET /analytics/speeds returned no rows."
            />
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speedChart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7a94" tick={{ fill: "#8b98b0", fontSize: 10 }} />
                  <YAxis stroke="#6b7a94" tick={{ fill: "#8b98b0", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1220",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                    }}
                  />
                  <Bar dataKey="speed" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Origin–destination</p>
              <h2>Traffic flows</h2>
            </div>
          </div>
          {odChart.length === 0 ? (
            <EmptyState
              title="No OD flows"
              message="GET /analytics/od returned no reconstructed journeys."
            />
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={odChart} layout="vertical">
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#6b7a94" tick={{ fill: "#8b98b0", fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    stroke="#6b7a94"
                    tick={{ fill: "#8b98b0", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0b1220",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                    }}
                  />
                  <Bar dataKey="vehicles" fill="#818cf8" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Multi-camera tracking</p>
              <h2>Recent trajectories</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => onNavigate("trajectories")}
            >
              View all
            </button>
          </div>
          <div className="trajectory-table">
            {trajectories.length === 0 ? (
              <EmptyState
                title="No trajectories"
                message="GET /trajectories returned an empty list."
              />
            ) : (
              trajectories.slice(0, 6).map((trajectory) => (
                <TrajectoryRow
                  key={trajectory.plate}
                  trajectory={trajectory}
                  onSelect={() => onNavigate("trajectories")}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

export default OverviewPage;
