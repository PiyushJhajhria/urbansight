import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { getVehicleTrajectory, searchPlate } from "../api";
import CityMap from "../components/CityMap";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingBlock from "../components/LoadingBlock";
import PageHeader from "../components/PageHeader";
import TrajectoryRow from "../components/TrajectoryRow";
import { useDashboard } from "../context/DashboardContext";
import { asArray, lastTimestamp, routeCameras } from "../utils/data";

function TrajectoriesPage() {
  const { trajectories, heatmap } = useDashboard();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [result, setResult] = useState(null);

  const selectedHeatmap = useMemo(() => {
    const route = asArray(result?.trajectory?.route);
    if (!route.length) return heatmap;
    const cameras = new Set(route.map((point) => point.camera_id));
    const filtered = heatmap.filter((item) => cameras.has(item.camera_id));
    return filtered.length ? filtered : heatmap;
  }, [heatmap, result]);

  async function runSearch(plateValue) {
    const plate = String(plateValue || "").trim();
    if (!plate) return;

    setQuery(plate);
    setSearching(true);
    setSearchError(null);

    try {
      const [plateResponse, trajectoryResponse] = await Promise.all([
        searchPlate(plate),
        getVehicleTrajectory(plate),
      ]);

      const events = asArray(plateResponse.data?.events);
      const trajectory = trajectoryResponse.data?.route
        ? trajectoryResponse.data
        : null;
      const notFound = events.length === 0 && !trajectory;

      setResult({
        plate: plateResponse.data?.plate || plate.toUpperCase(),
        events,
        trajectory,
        message: trajectoryResponse.data?.message || null,
        notFound,
      });
    } catch {
      setResult(null);
      setSearchError(
        "Plate lookup failed. Confirm the backend is running and the plate endpoint is reachable."
      );
    } finally {
      setSearching(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    runSearch(query);
  }

  const cameras = routeCameras(result?.trajectory);
  const ocrReadings = asArray(result?.trajectory?.route).filter(
    (point) => point.plate_read
  );

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Multi-camera ANPR"
        title="Vehicle trajectories"
        description="Search a plate against /plate/{plate} and /trajectory/{plate}, then inspect ordered camera hops."
      />

      <form className="search-panel" onSubmit={onSubmit}>
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search plate number, e.g. DL3CAB9876"
          aria-label="Plate number"
        />
        <button type="submit">Search vehicle</button>
      </form>

      <ErrorBanner message={searchError} />

      {searching ? <LoadingBlock label="Querying plate records..." /> : null}

      {result && !searching ? (
        <div className="panel search-result">
          {result.notFound ? (
            <EmptyState
              title="Plate not found"
              message={`No events or reconstructed trajectory for ${result.plate}.`}
            />
          ) : (
            <>
              <div className="result-hero">
                <div>
                  <p className="panel-eyebrow">Matched vehicle</p>
                  <h2 className="plate-display">{result.plate}</h2>
                  <p>
                    Last seen{" "}
                    {lastTimestamp(result.trajectory) ||
                      result.events[result.events.length - 1]?.timestamp ||
                      "unknown"}
                  </p>
                </div>
                {result.message && !result.trajectory ? (
                  <span className="trajectory-count">{result.message}</span>
                ) : null}
              </div>

              <div className="route-flow large">
                {cameras.length === 0 ? (
                  <span className="muted">No ordered camera path available.</span>
                ) : (
                  cameras.map((cameraId, index) => (
                    <div className="route-node" key={`${cameraId}-${index}`}>
                      <span>{cameraId}</span>
                      {index < cameras.length - 1 ? <div className="route-line" /> : null}
                    </div>
                  ))
                )}
              </div>

              <div className="split-grid">
                <div>
                  <h3 className="subhead">Ordered trajectory</h3>
                  <div className="detail-list">
                    {asArray(result.trajectory?.route).length === 0 ? (
                      <EmptyState
                        title="Trajectory not found"
                        message="The trajectory endpoint did not return a route for this plate."
                      />
                    ) : (
                      asArray(result.trajectory.route).map((point, index) => (
                        <div className="detail-row" key={`${point.camera_id}-${index}`}>
                          <strong>{point.camera_id}</strong>
                          <span>{point.timestamp || "No timestamp"}</span>
                          {point.plate_read ? <em>OCR {point.plate_read}</em> : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="subhead">Individual OCR / event readings</h3>
                  <div className="detail-list">
                    {result.events.length === 0 && ocrReadings.length === 0 ? (
                      <EmptyState
                        title="No OCR rows"
                        message="Plate search returned no event records."
                      />
                    ) : (
                      (result.events.length ? result.events : ocrReadings).map(
                        (event, index) => (
                          <div
                            className="detail-row"
                            key={`${event.camera_id}-${event.timestamp}-${index}`}
                          >
                            <strong>{event.plate || event.plate_read || result.plate}</strong>
                            <span>
                              {event.camera_id} · {event.timestamp || "No timestamp"}
                            </span>
                            {event.track_id != null ? <em>Track {event.track_id}</em> : null}
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>

              {asArray(result.trajectory?.route).some(
                (point) => point.lat != null && point.lon != null
              ) ? (
                <div className="result-map">
                  <h3 className="subhead">Reconstructed route</h3>
                  <CityMap
                    heatmap={selectedHeatmap}
                    trajectories={[result.trajectory]}
                    selectedPlate={result.plate}
                    height={340}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Tracked vehicles</p>
            <h2>All reconstructed trajectories</h2>
          </div>
          <span className="trajectory-count">{trajectories.length} tracked</span>
        </div>
        <div className="trajectory-table">
          {trajectories.length === 0 ? (
            <EmptyState
              title="No trajectories"
              message="GET /trajectories returned an empty list."
            />
          ) : (
            trajectories.map((trajectory) => (
              <TrajectoryRow
                key={trajectory.plate}
                trajectory={trajectory}
                onSelect={runSearch}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default TrajectoriesPage;
