import { Camera, MapPin } from "lucide-react";

function CameraCard({ camera }) {
  const location =
    camera.lat != null && camera.lon != null
      ? `${Number(camera.lat).toFixed(4)}, ${Number(camera.lon).toFixed(4)}`
      : "Coordinates unavailable";

  return (
    <article className="panel camera-card">
      <div className="camera-card-header">
        <div className="camera-card-icon">
          <Camera size={22} />
        </div>
        <div className="camera-online demo">
          <span />
          DEMO NODE
        </div>
      </div>

      <h3>{camera.camera_id}</h3>
      <p>Smart ANPR camera node · simulated stream status</p>

      <div className="camera-location">
        <MapPin size={13} />
        {location}
      </div>

      <div className="camera-divider" />

      <div className="camera-stats">
        <div>
          <span className="camera-stat-label">Unique vehicles</span>
          <strong>{camera.vehicle_count ?? 0}</strong>
        </div>
        <div>
          <span className="camera-stat-label">ANPR reads</span>
          <strong>{camera.detections ?? camera.vehicle_count ?? 0}</strong>
        </div>
      </div>
    </article>
  );
}

export default CameraCard;
