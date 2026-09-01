import { AlertTriangle, Ban, Gauge, ShieldAlert } from "lucide-react";

import {
  alertLocation,
  alertPlate,
  alertSeverity,
  alertTimestamp,
  formatAlertType,
} from "../utils/data";

function AlertTypeIcon({ type, size }) {
  if (type === "BLACKLIST_MATCH") return <Ban size={size} />;
  if (type === "IMPOSSIBLE_SPEED") return <Gauge size={size} />;
  if (type === "RESTRICTED_ROUTE") return <ShieldAlert size={size} />;
  return <AlertTriangle size={size} />;
}

function AlertCard({ alert, compact = false }) {
  const type = alert?.type;
  const severity = alertSeverity(type);
  const plate = alertPlate(alert);
  const timestamp = alertTimestamp(alert);

  return (
    <article className={`alert-item ${compact ? "" : "alert-item-large"} tone-${severity.tone}`}>
      <div className="alert-icon">
        <AlertTypeIcon type={type} size={compact ? 16 : 18} />
      </div>

      <div className="alert-information">
        <strong>{formatAlertType(type)}</strong>
        <p>{plate || "Vehicle event"}</p>
        <span>{alertLocation(alert)}</span>
        {timestamp ? <span className="alert-time">{timestamp}</span> : null}

        {!compact ? (
          <div className="alert-meta">
            {alert.camera_id ? <em>Camera {alert.camera_id}</em> : null}
            {alert.from_camera ? <em>From {alert.from_camera}</em> : null}
            {alert.to_camera ? <em>To {alert.to_camera}</em> : null}
            {alert.required_speed_kmph != null ? (
              <em>{alert.required_speed_kmph} km/h required</em>
            ) : null}
            {alert.similarity != null ? <em>Similarity {alert.similarity}</em> : null}
            {alert.matched_with ? <em>Matched {alert.matched_with}</em> : null}
            {alert.anomaly_type ? <em>{alert.anomaly_type}</em> : null}
          </div>
        ) : null}
      </div>

      <div className={`severity-badge ${severity.tone}`}>{severity.label}</div>
    </article>
  );
}

export default AlertCard;
