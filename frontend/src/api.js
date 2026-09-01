import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 15000,
});

export const getRoot = () => api.get("/");

export const getEvents = () => api.get("/events");

export const getTrajectories = () => api.get("/trajectories");

export const getAlerts = () => api.get("/alerts");

export const getCounts = () => api.get("/analytics/counts");

export const getSpeeds = () => api.get("/analytics/speeds");

export const getOD = () => api.get("/analytics/od");

export const getHeatmap = () => api.get("/analytics/heatmap");

export const searchPlate = (plate) =>
  api.get(`/plate/${encodeURIComponent(plate)}`);

export const getVehicleTrajectory = (plate) =>
  api.get(`/trajectory/${encodeURIComponent(plate)}`);

export default api;
