export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function alertPlate(alert) {
  if (!alert || typeof alert !== "object") return null;
  return alert.plate || alert.plate_candidate || alert.matched_with || null;
}

export function alertLocation(alert) {
  if (!alert || typeof alert !== "object") return "Unknown node";
  if (alert.from_camera && alert.to_camera) {
    return `${alert.from_camera} → ${alert.to_camera}`;
  }
  return alert.camera_id || alert.to_camera || alert.from_camera || "Unknown node";
}

export function alertTimestamp(alert) {
  if (!alert || typeof alert !== "object") return null;
  return (
    alert.timestamp ||
    alert.to_timestamp ||
    alert.from_timestamp ||
    alert.alert_generated_at ||
    null
  );
}

export function alertSeverity(type) {
  switch (type) {
    case "BLACKLIST_MATCH":
      return { label: "Critical", tone: "critical" };
    case "IMPOSSIBLE_SPEED":
      return { label: "High", tone: "high" };
    case "RESTRICTED_ROUTE":
      return { label: "Watch", tone: "watch" };
    default:
      return { label: "Info", tone: "info" };
  }
}

export function formatAlertType(type) {
  if (!type) return "Unknown event";
  return String(type).replaceAll("_", " ");
}

export function routeCameras(trajectory) {
  const route = asArray(trajectory?.route);
  return route.map((point) => point.camera_id).filter(Boolean);
}

export function lastTimestamp(trajectory) {
  const route = asArray(trajectory?.route);
  return route[route.length - 1]?.timestamp || null;
}

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function heatmapIntensity(count, maxCount) {
  if (!maxCount) return 0.25;
  return Math.min(0.85, 0.22 + (count / maxCount) * 0.63);
}

export function plateColor(plate) {
  const palette = [
    "#5b8cff",
    "#22d3ee",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#fb7185",
    "#38bdf8",
  ];
  let hash = 0;
  for (const ch of String(plate || "")) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function routeLatLngs(trajectory) {
  return asArray(trajectory?.route)
    .filter(
      (point) =>
        Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon))
    )
    .map((point) => [Number(point.lat), Number(point.lon)]);
}

export function mergeCameraNodes(counts, heatmap) {
  const nodes = new Map();

  asArray(heatmap).forEach((item) => {
    if (!item?.camera_id) return;
    nodes.set(item.camera_id, {
      camera_id: item.camera_id,
      lat: item.lat,
      lon: item.lon,
      detections: Number(item.vehicle_count || 0),
      vehicle_count: Number(item.vehicle_count || 0),
    });
  });

  asArray(counts).forEach((item) => {
    if (!item?.camera_id) return;
    const existing = nodes.get(item.camera_id) || { camera_id: item.camera_id };
    nodes.set(item.camera_id, {
      ...existing,
      vehicle_count: Number(item.vehicle_count || 0),
      detections: existing.detections ?? Number(item.vehicle_count || 0),
    });
  });

  return Array.from(nodes.values()).sort((a, b) =>
    String(a.camera_id).localeCompare(String(b.camera_id))
  );
}

export function validCoords(item) {
  return (
    item &&
    Number.isFinite(Number(item.lat)) &&
    Number.isFinite(Number(item.lon))
  );
}
