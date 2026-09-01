import CameraCard from "../components/CameraCard";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useDashboard } from "../context/DashboardContext";
import { mergeCameraNodes } from "../utils/data";

function CamerasPage() {
  const { counts, heatmap } = useDashboard();
  const cameras = mergeCameraNodes(counts, heatmap);

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="Distributed camera network"
        title="ANPR camera nodes"
        description="Vehicle counts from /analytics/counts. Locations from /analytics/heatmap. Stream status is simulated for this prototype — the backend does not expose live video health."
      />

      {cameras.length === 0 ? (
        <EmptyState
          title="No cameras"
          message="Counts and heatmap APIs returned no camera nodes."
        />
      ) : (
        <div className="camera-grid">
          {cameras.map((camera) => (
            <CameraCard key={camera.camera_id} camera={camera} />
          ))}
        </div>
      )}
    </section>
  );
}

export default CamerasPage;
