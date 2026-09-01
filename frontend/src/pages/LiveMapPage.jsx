import { useMemo, useState } from "react";

import CityMap from "../components/CityMap";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useDashboard } from "../context/DashboardContext";
import { plateColor, routeCameras } from "../utils/data";

function LiveMapPage() {
  const { heatmap, trajectories } = useDashboard();
  const [showCameras, setShowCameras] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [selectedPlate, setSelectedPlate] = useState(null);

  const legend = useMemo(
    () => trajectories.slice(0, 10),
    [trajectories]
  );

  const hasGeo =
    heatmap.some((item) => item.lat != null && item.lon != null) ||
    trajectories.some((item) =>
      (item.route || []).some((point) => point.lat != null && point.lon != null)
    );

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="GIS intelligence"
        title="Live city network map"
        description="Camera nodes and traffic intensity from /analytics/heatmap. Routes are drawn from reconstructed trajectories."
      />

      <div className="map-toolbar">
        <button
          type="button"
          className={showCameras ? "toolbar-chip active" : "toolbar-chip"}
          onClick={() => setShowCameras((value) => !value)}
        >
          Camera network
        </button>
        <button
          type="button"
          className={showHeatmap ? "toolbar-chip active" : "toolbar-chip"}
          onClick={() => setShowHeatmap((value) => !value)}
        >
          Traffic heatmap
        </button>
        <button
          type="button"
          className={showTrajectories ? "toolbar-chip active" : "toolbar-chip"}
          onClick={() => setShowTrajectories((value) => !value)}
        >
          Trajectories
        </button>
        {selectedPlate ? (
          <button
            type="button"
            className="toolbar-chip"
            onClick={() => setSelectedPlate(null)}
          >
            Clear plate filter
          </button>
        ) : null}
      </div>

      <div className="map-layout">
        <div className="panel map-panel">
          {!hasGeo ? (
            <EmptyState
              title="No map coordinates"
              message="The backend did not return latitude/longitude for cameras or routes."
            />
          ) : (
            <CityMap
              heatmap={heatmap}
              trajectories={trajectories}
              selectedPlate={selectedPlate}
              showCameras={showCameras}
              showHeatmap={showHeatmap}
              showTrajectories={showTrajectories}
              height={560}
            />
          )}
        </div>

        <aside className="panel map-legend-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Tracked plates</p>
              <h2>Route legend</h2>
            </div>
          </div>
          <p className="muted legend-copy">
            Select a plate to isolate its path. Popup data uses plate, camera, and timestamp from the trajectory feed.
          </p>
          <div className="legend-list">
            {legend.length === 0 ? (
              <EmptyState
                title="No routes"
                message="GET /trajectories is empty."
              />
            ) : (
              legend.map((item) => (
                <button
                  key={item.plate}
                  type="button"
                  className={
                    selectedPlate === item.plate
                      ? "legend-item active"
                      : "legend-item"
                  }
                  onClick={() =>
                    setSelectedPlate((current) =>
                      current === item.plate ? null : item.plate
                    )
                  }
                >
                  <span
                    className="legend-swatch"
                    style={{ background: plateColor(item.plate) }}
                  />
                  <div>
                    <strong>{item.plate}</strong>
                    <span>{routeCameras(item).join(" → ") || "No cameras"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default LiveMapPage;
