import {
  AlertTriangle,
  Camera,
  Car,
  Gauge,
  Route,
  Waypoints,
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

  // ==========================================================
  // CAMERA COUNTS
  // ==========================================================

  const countChart = counts.map((item) => ({
    name: item.camera_id,
    vehicles: Number(item.vehicle_count || 0),
  }));

  // ==========================================================
  // SPEED ANALYTICS
  // ==========================================================

  const speedChart = speeds.map((item) => ({
    name: `${item.from_camera}→${item.to_camera}`,
    speed: Number(item.average_speed_kmph || 0),
  }));

  // ==========================================================
  // ORIGIN–DESTINATION ANALYTICS
  // ==========================================================

  const odChart = odFlows
    .map((item) => ({
      origin: item.origin,
      destination: item.destination,

      name: `${item.origin} → ${item.destination}`,

      vehicles: Number(item.vehicle_count || 0),
    }))
    .sort((a, b) => b.vehicles - a.vehicles);

  const totalODJourneys = odChart.reduce(
    (sum, item) => sum + item.vehicles,
    0
  );

  const busiestCorridor =
    odChart.length > 0 ? odChart[0] : null;

  const activeODPairs = odChart.filter(
    (item) => item.vehicles > 0
  ).length;

  const strongestTrafficShare =
    busiestCorridor && totalODJourneys > 0
      ? (
          (busiestCorridor.vehicles / totalODJourneys) *
          100
        ).toFixed(1)
      : 0;

  const odChartWithShare = odChart.map((item) => ({
    ...item,

    share:
      totalODJourneys > 0
        ? (
            (item.vehicles / totalODJourneys) *
            100
          ).toFixed(1)
        : 0,
  }));

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <section className="page-section">

      <PageHeader
        eyebrow="Executive overview"
        title="City operations snapshot"
        description="Live ANPR intelligence including vehicle activity, reconstructed trajectories, traffic flows, segment speeds, and real-time alerts."
      />

      {/* ======================================================
          MAIN METRICS
      ====================================================== */}

      <div className="stats-grid">

        <StatCard
          title="Vehicles detected"
          value={metrics.totalVehicles}
          subtitle="Unique plates observed across the city network"
          icon={Car}
          tone="blue"
        />

        <StatCard
          title="Active cameras"
          value={metrics.activeCameras}
          subtitle="ANPR nodes reporting traffic observations"
          icon={Camera}
          tone="cyan"
        />

        <StatCard
          title="Average segment speed"
          value={`${metrics.averageSpeed} km/h`}
          subtitle="Mean camera-to-camera estimated speed"
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

      {/* ======================================================
          MAP + ALERTS
      ====================================================== */}

      <section className="dashboard-grid">

        <div className="panel">

          <div className="panel-header">

            <div>
              <p className="panel-eyebrow">
                City network
              </p>

              <h2>
                Road traffic intelligence
              </h2>
            </div>

            <button
              className="ghost-button"
              type="button"
              onClick={() => onNavigate("map")}
            >
              Open live map
            </button>

          </div>

          {heatmap.length === 0 &&
          trajectories.length === 0 ? (

            <EmptyState
              title="No geospatial data"
              message="No camera or trajectory coordinates were returned by the backend."
            />

          ) : (

            <CityMap
              heatmap={heatmap}
              trajectories={trajectories}
              height={340}
              showTrajectories={false}
            />

          )}

        </div>

        <div className="panel">

          <div className="panel-header">

            <div>
              <p className="panel-eyebrow">
                Threat monitor
              </p>

              <h2>
                Recent alerts
              </h2>
            </div>

            <span className="alert-count">
              {alerts.length}
            </span>

          </div>

          <div className="alert-list">

            {alerts.length === 0 ? (

              <EmptyState
                title="No alerts"
                message="No active traffic or security alerts."
              />

            ) : (

              alerts
                .slice(0, 4)
                .map((alert, index) => (

                  <AlertCard
                    key={`${alert.type}-${index}`}
                    alert={alert}
                    compact
                  />

                ))

            )}

          </div>

          {alerts.length > 0 ? (

            <button
              className="full-button"
              type="button"
              onClick={() => onNavigate("alerts")}
            >
              View all alerts
            </button>

          ) : null}

        </div>

      </section>

      {/* ======================================================
          CAMERA LOAD + SPEED
      ====================================================== */}

      <section className="chart-grid">

        {/* CAMERA LOAD */}

        <div className="panel">

          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">
                Camera load
              </p>

              <h2>
                Unique vehicles per camera
              </h2>
            </div>
          </div>

          {countChart.length === 0 ? (

            <EmptyState
              title="No count data"
              message="No camera count analytics are currently available."
            />

          ) : (

            <div className="chart-box">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart data={countChart}>

                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    stroke="#6b7a94"
                    tick={{
                      fill: "#8b98b0",
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    stroke="#6b7a94"
                    tick={{
                      fill: "#8b98b0",
                      fontSize: 11,
                    }}
                    allowDecimals={false}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#0b1220",
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                    }}
                  />

                  <Bar
                    dataKey="vehicles"
                    fill="#4c7dff"
                    radius={[6, 6, 0, 0]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          )}

        </div>

        {/* SPEED */}

        <div className="panel">

          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">
                Segment speeds
              </p>

              <h2>
                Average speed (km/h)
              </h2>
            </div>
          </div>

          {speedChart.length === 0 ? (

            <EmptyState
              title="No speed data"
              message="Speed analytics require multi-camera trajectory segments."
            />

          ) : (

            <div className="chart-box">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart data={speedChart}>

                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    stroke="#6b7a94"
                    tick={{
                      fill: "#8b98b0",
                      fontSize: 10,
                    }}
                  />

                  <YAxis
                    stroke="#6b7a94"
                    tick={{
                      fill: "#8b98b0",
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#0b1220",
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                    }}
                  />

                  <Bar
                    dataKey="speed"
                    fill="#22d3ee"
                    radius={[6, 6, 0, 0]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          )}

        </div>

      </section>

      {/* ======================================================
          ORIGIN–DESTINATION INTELLIGENCE
      ====================================================== */}

      <div
        className="panel"
        style={{
          marginBottom: "20px",
        }}
      >

        <div className="panel-header">

          <div>
            <p className="panel-eyebrow">
              Origin–destination intelligence
            </p>

            <h2>
              City movement patterns
            </h2>

            <p className="muted">
              Aggregated origin-to-destination flows derived
              from reconstructed multi-camera vehicle journeys.
            </p>
          </div>

          <Route size={22} />

        </div>

        {odChart.length === 0 ? (

          <EmptyState
            title="No OD flows"
            message="Origin–destination analytics require reconstructed multi-camera journeys."
          />

        ) : (

          <>

            {/* OD SUMMARY */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                margin: "18px 0 24px",
              }}
            >

              <div className="od-summary-card">

                <span className="muted">
                  Busiest corridor
                </span>

                <strong>
                  {busiestCorridor.name}
                </strong>

                <small>
                  {busiestCorridor.vehicles} reconstructed journeys
                </small>

              </div>

              <div className="od-summary-card">

                <span className="muted">
                  Total OD journeys
                </span>

                <strong>
                  {totalODJourneys}
                </strong>

                <small>
                  Aggregated reconstructed movements
                </small>

              </div>

              <div className="od-summary-card">

                <span className="muted">
                  Active OD pairs
                </span>

                <strong>
                  {activeODPairs}
                </strong>

                <small>
                  Camera origin–destination combinations
                </small>

              </div>

              <div className="od-summary-card">

                <span className="muted">
                  Top corridor share
                </span>

                <strong>
                  {strongestTrafficShare}%
                </strong>

                <small>
                  Share of reconstructed OD traffic
                </small>

              </div>

            </div>

            {/* OD VISUALIZATION */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.5fr) minmax(280px, 0.7fr)",
                gap: "20px",
                alignItems: "stretch",
              }}
            >

              <div className="chart-box">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <BarChart
                    data={odChartWithShare}
                    layout="vertical"
                    margin={{
                      left: 10,
                      right: 25,
                    }}
                  >

                    <CartesianGrid
                      stroke="rgba(255,255,255,0.06)"
                      horizontal={false}
                    />

                    <XAxis
                      type="number"
                      stroke="#6b7a94"
                      allowDecimals={false}
                      tick={{
                        fill: "#8b98b0",
                        fontSize: 11,
                      }}
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={135}
                      stroke="#6b7a94"
                      tick={{
                        fill: "#8b98b0",
                        fontSize: 11,
                      }}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "#0b1220",
                        border:
                          "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                      }}
                      formatter={(value) => [
                        `${value} vehicles`,
                        "Reconstructed journeys",
                      ]}
                    />

                    <Bar
                      dataKey="vehicles"
                      fill="#818cf8"
                      radius={[0, 7, 7, 0]}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>

              {/* RANKED OD LIST */}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  <Waypoints size={17} />

                  <strong>
                    Ranked corridors
                  </strong>
                </div>

                {odChartWithShare
                  .slice(0, 5)
                  .map((flow, index) => (

                    <div
                      key={`${flow.origin}-${flow.destination}`}
                      style={{
                        padding: "13px 14px",
                        borderRadius: "12px",
                        border:
                          "1px solid rgba(148,163,184,.14)",
                        background:
                          "rgba(15,23,42,.45)",
                      }}
                    >

                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                        }}
                      >

                        <strong>
                          #{index + 1}{" "}
                          {flow.origin}
                          {" → "}
                          {flow.destination}
                        </strong>

                        <strong>
                          {flow.vehicles}
                        </strong>

                      </div>

                      <div
                        style={{
                          marginTop: "7px",
                          color: "#94a3b8",
                          fontSize: "12px",
                        }}
                      >
                        {flow.share}% of reconstructed OD traffic
                      </div>

                    </div>

                  ))}

              </div>

            </div>

          </>

        )}

      </div>

      {/* ======================================================
          RECENT TRAJECTORIES
      ====================================================== */}

      <div className="panel">

        <div className="panel-header">

          <div>
            <p className="panel-eyebrow">
              Multi-camera tracking
            </p>

            <h2>
              Recent trajectories
            </h2>
          </div>

          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              onNavigate("trajectories")
            }
          >
            View all
          </button>

        </div>

        <div className="trajectory-table">

          {trajectories.length === 0 ? (

            <EmptyState
              title="No trajectories"
              message="No reconstructed multi-camera journeys are currently available."
            />

          ) : (

            trajectories
              .slice(0, 6)
              .map((trajectory) => (

                <TrajectoryRow
                  key={trajectory.plate}
                  trajectory={trajectory}
                  onSelect={() =>
                    onNavigate(
                      "trajectories"
                    )
                  }
                />

              ))

          )}

        </div>

      </div>

    </section>
  );
}

export default OverviewPage;