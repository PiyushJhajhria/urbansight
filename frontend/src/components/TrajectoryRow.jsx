import { lastTimestamp, routeCameras } from "../utils/data";

function TrajectoryRow({ trajectory, onSelect }) {
  const cameras = routeCameras(trajectory);
  const timestamp = lastTimestamp(trajectory);

  return (
    <button
      className="trajectory-row"
      onClick={() => onSelect?.(trajectory.plate)}
      type="button"
    >
      <div className="plate-badge">{trajectory.plate || "Unknown plate"}</div>

      <div className="route-flow">
        {cameras.length === 0 ? (
          <span className="muted">No route points</span>
        ) : (
          cameras.map((cameraId, index) => (
            <div className="route-node" key={`${cameraId}-${index}`}>
              <span>{cameraId}</span>
              {index < cameras.length - 1 ? <div className="route-line" /> : null}
            </div>
          ))
        )}
      </div>

      <span className="route-time">{timestamp || "No timestamp"}</span>
    </button>
  );
}

export default TrajectoryRow;
