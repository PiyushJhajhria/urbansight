import { useEffect, useMemo } from "react";
import L from "leaflet";

import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import {
  asArray,
  plateColor,
  routeLatLngs,
  validCoords,
} from "../utils/data";


const DEFAULT_CENTER = [21.185, 72.82];


// ============================================================
// MAP AUTO FIT
// ============================================================

function MapEffects({ points }) {
  const map = useMap();


  useEffect(() => {
    const timer = window.setTimeout(
      () => map.invalidateSize(),
      100
    );

    return () =>
      window.clearTimeout(timer);
  }, [map]);


  useEffect(() => {
    if (!points.length) return;


    map.fitBounds(
      L.latLngBounds(points),
      {
        padding: [50, 50],
        maxZoom: 13,
      }
    );
  }, [map, points]);


  return null;
}


// ============================================================
// CAMERA DENSITY RANKING
// ============================================================

function getDensityLevels(cameraPoints) {
  const sorted = [...cameraPoints].sort(
    (a, b) =>
      Number(b.vehicle_count || 0) -
      Number(a.vehicle_count || 0)
  );


  const result = {};


  sorted.forEach((camera, index) => {
    if (sorted.length === 1) {
      result[camera.camera_id] = {
        level: "High",
        color: "#ef4444",
      };

      return;
    }


    if (sorted.length === 2) {
      result[camera.camera_id] =
        index === 0
          ? {
              level: "High",
              color: "#ef4444",
            }
          : {
              level: "Low",
              color: "#22c55e",
            };

      return;
    }


    // For 3 cameras:
    //
    // Highest → RED
    // Middle  → ORANGE
    // Lowest  → GREEN

    if (index === 0) {
      result[camera.camera_id] = {
        level: "High",
        color: "#ef4444",
      };
    }

    else if (index === 1) {
      result[camera.camera_id] = {
        level: "Medium",
        color: "#f59e0b",
      };
    }

    else {
      result[camera.camera_id] = {
        level: "Low",
        color: "#22c55e",
      };
    }
  });


  return result;
}


// ============================================================
// MAIN MAP
// ============================================================

function CityMap({
  heatmap = [],
  trajectories = [],
  selectedPlate = null,
  showCameras = true,
  showHeatmap = true,
  showTrajectories = true,
  height = 520,
}) {

  // ----------------------------------------------------------
  // CAMERA POINTS
  // ----------------------------------------------------------

  const cameraPoints = useMemo(
    () =>
      asArray(heatmap).filter(
        validCoords
      ),
    [heatmap]
  );


  // ----------------------------------------------------------
  // RANK CAMERAS BY VEHICLE COUNT
  // ----------------------------------------------------------

  const densityLevels = useMemo(
    () =>
      getDensityLevels(
        cameraPoints
      ),
    [cameraPoints]
  );


  // ----------------------------------------------------------
  // TRAJECTORIES
  // ----------------------------------------------------------

  const visibleTrajectories =
    useMemo(() => {

      const list = asArray(
        trajectories
      ).filter(
        (item) =>
          routeLatLngs(item).length >= 2
      );


      if (!selectedPlate) {
        return list;
      }


      return list.filter(
        (item) =>
          String(
            item.plate
          ).toUpperCase()
          ===
          String(
            selectedPlate
          ).toUpperCase()
      );

    }, [
      selectedPlate,
      trajectories,
    ]);


  // ----------------------------------------------------------
  // MAP BOUNDS
  // ----------------------------------------------------------

  const boundPoints = useMemo(() => {

    const points =
      cameraPoints.map(
        (camera) => [
          Number(camera.lat),
          Number(camera.lon),
        ]
      );


    visibleTrajectories.forEach(
      (trajectory) => {

        points.push(
          ...routeLatLngs(
            trajectory
          )
        );

      }
    );


    return points;

  }, [
    cameraPoints,
    visibleTrajectories,
  ]);


  return (

    <div
      className="city-map"
      style={{
        height,
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
      }}
    >

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        scrollWheelZoom
        className="leaflet-host"
        style={{
          width: "100%",
          height: "100%",
        }}
      >

        {/* ==================================================
            BASE MAP
        ================================================== */}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        <MapEffects
          points={
            boundPoints
          }
        />


        {/* ==================================================
            CAMERA-WISE TRAFFIC DENSITY
        ================================================== */}

        {showHeatmap
          ? cameraPoints.map(
              (camera) => {

                const density =
                  densityLevels[
                    camera.camera_id
                  ] || {
                    level: "Unknown",
                    color: "#64748b",
                  };


                return (

                  <Circle
                    key={
                      `density-${camera.camera_id}`
                    }
                    center={[
                      Number(
                        camera.lat
                      ),
                      Number(
                        camera.lon
                      ),
                    ]}

                    // Smaller zones:
                    // prevents the ugly overlapping blobs
                    radius={450}

                    pathOptions={{
                      color:
                        density.color,

                      fillColor:
                        density.color,

                      fillOpacity:
                        0.24,

                      opacity:
                        0.75,

                      weight:
                        2,
                    }}
                  >

                    <Popup>

                      <strong>
                        {
                          camera.camera_id
                        }
                      </strong>


                      <div>
                        Traffic level:{" "}
                        <strong>
                          {
                            density.level
                          }
                        </strong>
                      </div>


                      <div>
                        Vehicle count:{" "}
                        {
                          camera.vehicle_count ??
                          0
                        }
                      </div>

                    </Popup>

                  </Circle>
                );
              }
            )
          : null}


        {/* ==================================================
            TRAJECTORY LINES
        ================================================== */}

        {showTrajectories
          ? visibleTrajectories.map(
              (trajectory) => {

                const latlngs =
                  routeLatLngs(
                    trajectory
                  );


                const color =
                  plateColor(
                    trajectory.plate
                  );


                return (

                  <Polyline
                    key={
                      `route-${trajectory.plate}`
                    }

                    positions={
                      latlngs
                    }

                    pathOptions={{
                      color,

                      weight:
                        selectedPlate ===
                        trajectory.plate
                          ? 5
                          : 3,

                      opacity:
                        0.8,
                    }}
                  >

                    <Popup>

                      <strong>
                        {
                          trajectory.plate
                        }
                      </strong>


                      <div>

                        {asArray(
                          trajectory.route
                        )
                          .map(
                            (point) =>
                              point.camera_id
                          )
                          .filter(Boolean)
                          .join(
                            " → "
                          )}

                      </div>

                    </Popup>

                  </Polyline>
                );
              }
            )
          : null}


        {/* ==================================================
            CAMERA MARKERS
        ================================================== */}

        {showCameras
          ? cameraPoints.map(
              (camera) => {

                const density =
                  densityLevels[
                    camera.camera_id
                  ] || {
                    level: "Unknown",
                    color: "#2563eb",
                  };


                return (

                  <CircleMarker
                    key={
                      `cam-${camera.camera_id}`
                    }

                    center={[
                      Number(
                        camera.lat
                      ),
                      Number(
                        camera.lon
                      ),
                    ]}

                    radius={7}

                    pathOptions={{
                      color:
                        "#ffffff",

                      weight:
                        2,

                      fillColor:
                        density.color,

                      fillOpacity:
                        1,
                    }}
                  >

                    <Tooltip
                      direction="top"
                      offset={[
                        0,
                        -7,
                      ]}
                      permanent
                    >

                      {
                        camera.camera_id
                      }

                    </Tooltip>


                    <Popup>

                      <strong>
                        {
                          camera.camera_id
                        }
                      </strong>


                      <div>
                        Traffic:{" "}
                        {
                          density.level
                        }
                      </div>


                      <div>
                        Vehicle count:{" "}
                        {
                          camera.vehicle_count ??
                          0
                        }
                      </div>


                      <div>

                        {
                          Number(
                            camera.lat
                          ).toFixed(
                            4
                          )
                        }

                        ,{" "}

                        {
                          Number(
                            camera.lon
                          ).toFixed(
                            4
                          )
                        }

                      </div>

                    </Popup>

                  </CircleMarker>
                );
              }
            )
          : null}


        {/* ==================================================
            ROUTE OBSERVATION POINTS
        ================================================== */}

        {showTrajectories
          ? visibleTrajectories.flatMap(
              (trajectory) =>

                asArray(
                  trajectory.route
                )
                  .filter(
                    validCoords
                  )
                  .map(
                    (
                      point,
                      index
                    ) => (

                      <CircleMarker
                        key={
                          `${trajectory.plate}-${point.camera_id}-${index}`
                        }

                        center={[
                          Number(
                            point.lat
                          ),
                          Number(
                            point.lon
                          ),
                        ]}

                        radius={4}

                        pathOptions={{
                          color:
                            plateColor(
                              trajectory.plate
                            ),

                          fillColor:
                            "#0f172a",

                          fillOpacity:
                            1,

                          weight:
                            2,
                        }}
                      >

                        <Popup>

                          <strong>
                            {
                              trajectory.plate
                            }
                          </strong>


                          <div>

                            Camera:{" "}
                            {
                              point.camera_id ||
                              "Unknown"
                            }

                          </div>


                          <div>

                            Time:{" "}
                            {
                              point.timestamp ||
                              "Unavailable"
                            }

                          </div>


                          {point.plate_read
                            ? (
                              <div>
                                OCR:{" "}
                                {
                                  point.plate_read
                                }
                              </div>
                            )
                            : null}

                        </Popup>

                      </CircleMarker>
                    )
                  )
            )
          : null}

      </MapContainer>


      {/* ====================================================
          DENSITY LEGEND
      ==================================================== */}

      <div
        style={{
          position: "absolute",
          bottom: "28px",
          left: "28px",
          zIndex: 1000,

          background:
            "rgba(15,23,42,0.94)",

          border:
            "1px solid rgba(148,163,184,0.22)",

          borderRadius:
            "12px",

          padding:
            "12px 16px",

          color:
            "#e2e8f0",

          fontSize:
            "13px",

          boxShadow:
            "0 8px 24px rgba(0,0,0,0.25)",
        }}
      >

        <div
          style={{
            fontWeight: 700,
            marginBottom: "9px",
          }}
        >
          Traffic Density
        </div>


        <div
          style={{
            display: "flex",
            gap: "16px",
          }}
        >

          <span>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#22c55e",
                marginRight: "6px",
              }}
            />
            Low
          </span>


          <span>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#f59e0b",
                marginRight: "6px",
              }}
            />
            Medium
          </span>


          <span>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#ef4444",
                marginRight: "6px",
              }}
            />
            High
          </span>

        </div>

      </div>

    </div>
  );
}


export default CityMap;