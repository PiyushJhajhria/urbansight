import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000",

  timeout: 15000,
});


// ============================================================
// SYSTEM
// ============================================================

export const getRoot = () =>
  api.get("/");


// ============================================================
// EVENTS
// ============================================================

export const getEvents = () =>
  api.get("/events");


// ============================================================
// TRAJECTORIES
// ============================================================

export const getTrajectories = () =>
  api.get("/trajectories");

export const getVehicleTrajectory = (plate) =>
  api.get(
    `/trajectory/${encodeURIComponent(plate)}`
  );

export const searchPlate = (plate) =>
  api.get(
    `/plate/${encodeURIComponent(plate)}`
  );


// ============================================================
// ALERTS
// ============================================================

export const getAlerts = () =>
  api.get("/alerts");


// ============================================================
// ANALYTICS
// ============================================================

export const getCounts = () =>
  api.get("/analytics/counts");

export const getSpeeds = () =>
  api.get("/analytics/speeds");

export const getOD = () =>
  api.get("/analytics/od");

export const getHeatmap = () =>
  api.get("/analytics/heatmap");


// ============================================================
// ROAD NETWORK / GIS
// ============================================================

export const getRoadNetwork = () =>
  api.get("/roads/network");

export const getRoadRoute = (
  fromCamera,
  toCamera
) =>
  api.get("/roads/route", {
    params: {
      from_camera: fromCamera,
      to_camera: toCamera,
    },
  });


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;