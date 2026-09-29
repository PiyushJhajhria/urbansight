import {
  useEffect,
  useMemo,
  useState,
} from "react";

import L from "leaflet";

import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import {
  getRoadNetwork,
} from "../api";

import {
  asArray,
  plateColor,
  validCoords,
} from "../utils/data";


// ============================================================
// MAP CONFIG
// ============================================================

const DEFAULT_CENTER = [
  21.185,
  72.82,
];


// ============================================================
// MAP EFFECTS
// ============================================================

function MapEffects({
  points,
}) {
  const map = useMap();

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        map.invalidateSize();
      }, 100);

    return () =>
      window.clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (!points.length) {
      return;
    }

    try {
      const bounds =
        L.latLngBounds(points);

      if (bounds.isValid()) {
        map.fitBounds(
          bounds,
          {
            padding: [
              50,
              50,
            ],

            maxZoom:
              14,
          }
        );
      }
    } catch (error) {
      console.error(
        "Map bounds error:",
        error
      );
    }
  }, [
    map,
    points,
  ]);

  return null;
}


// ============================================================
// ROAD POINT NORMALIZER
// ============================================================

function normalizeRoadPoints(
  points
) {
  return asArray(points)
    .filter(
      (point) =>
        point?.lat != null &&
        point?.lon != null
    )
    .map(
      (point) => [
        Number(
          point.lat
        ),

        Number(
          point.lon
        ),
      ]
    )
    .filter(
      ([lat, lon]) =>
        Number.isFinite(
          lat
        ) &&
        Number.isFinite(
          lon
        )
    );
}


// ============================================================
// CAMERA-PAIR KEY
// ============================================================

function pairKey(
  cameraA,
  cameraB
) {
  return [
    cameraA,
    cameraB,
  ]
    .sort()
    .join("-");
}


// ============================================================
// COUNT VEHICLES USING EACH CAMERA SEGMENT
// ============================================================

function buildSegmentCounts(
  trajectories
) {
  const counts = {};

  asArray(
    trajectories
  ).forEach(
    (trajectory) => {
      const route =
        asArray(
          trajectory?.route
        ).filter(
          validCoords
        );

      for (
        let i = 0;
        i <
        route.length - 1;
        i += 1
      ) {
        const from =
          route[i]
            ?.camera_id;

        const to =
          route[i + 1]
            ?.camera_id;

        if (
          !from ||
          !to ||
          from === to
        ) {
          continue;
        }

        const key =
          pairKey(
            from,
            to
          );

        counts[key] =
          (
            counts[key] ||
            0
          ) + 1;
      }
    }
  );

  return counts;
}


// ============================================================
// ROAD TRAFFIC LEVEL
// ============================================================

function getRoadTrafficInfo(
  count,
  maxCount
) {
  if (
    !count ||
    count <= 0
  ) {
    return {
      level:
        "No traffic data",

      color:
        "#64748b",

      weight:
        4,
    };
  }

  if (
    maxCount <= 1
  ) {
    return {
      level:
        "Low",

      color:
        "#22c55e",

      weight:
        6,
    };
  }

  const ratio =
    count /
    maxCount;

  if (
    ratio >= 0.67
  ) {
    return {
      level:
        "High",

      color:
        "#ef4444",

      weight:
        10,
    };
  }

  if (
    ratio >= 0.34
  ) {
    return {
      level:
        "Moderate",

      color:
        "#f59e0b",

      weight:
        8,
    };
  }

  return {
    level:
      "Low",

    color:
      "#22c55e",

    weight:
      6,
  };
}


// ============================================================
// FIND ROAD SEGMENT
// ============================================================

function getRoadSegment(
  roadNetwork,
  fromCamera,
  toCamera
) {
  const direct =
    asArray(
      roadNetwork
    ).find(
      (route) =>
        route
          .from_camera ===
          fromCamera &&
        route
          .to_camera ===
          toCamera
    );

  if (direct) {
    return {
      ...direct,

      latlngs:
        normalizeRoadPoints(
          direct.points
        ),
    };
  }

  const reverse =
    asArray(
      roadNetwork
    ).find(
      (route) =>
        route
          .from_camera ===
          toCamera &&
        route
          .to_camera ===
          fromCamera
    );

  if (reverse) {
    return {
      ...reverse,

      from_camera:
        fromCamera,

      to_camera:
        toCamera,

      latlngs:
        normalizeRoadPoints(
          reverse.points
        ).reverse(),
    };
  }

  return null;
}


// ============================================================
// BUILD VEHICLE ROAD TRAJECTORY
// ============================================================

function buildRoadTrajectory(
  trajectory,
  roadNetwork
) {
  const observations =
    asArray(
      trajectory?.route
    ).filter(
      validCoords
    );

  if (
    observations.length <
    2
  ) {
    return observations.map(
      (point) => [
        Number(
          point.lat
        ),

        Number(
          point.lon
        ),
      ]
    );
  }

  const completeRoute =
    [];

  for (
    let i = 0;
    i <
    observations.length - 1;
    i += 1
  ) {
    const current =
      observations[i];

    const next =
      observations[
        i + 1
      ];

    const roadSegment =
      getRoadSegment(
        roadNetwork,
        current.camera_id,
        next.camera_id
      );

    const segment =
      roadSegment
        ?.latlngs
        ?.length >= 2

        ? roadSegment
            .latlngs

        : [
            [
              Number(
                current.lat
              ),

              Number(
                current.lon
              ),
            ],

            [
              Number(
                next.lat
              ),

              Number(
                next.lon
              ),
            ],
          ];

    if (i === 0) {
      completeRoute.push(
        ...segment
      );
    } else {
      completeRoute.push(
        ...segment.slice(
          1
        )
      );
    }
  }

  return completeRoute;
}


// ============================================================
// NUMBERED CAMERA OBSERVATION ICON
// ============================================================

function createNumberIcon(
  number,
  color
) {
  return L.divIcon({
    className:
      "",

    html: `
      <div style="
        width:36px;
        height:36px;

        border-radius:50%;

        background:${color};

        border:3px solid white;

        color:white;

        display:flex;

        align-items:center;
        justify-content:center;

        font-size:14px;
        font-weight:800;

        box-shadow:
          0 5px 18px
          rgba(15,23,42,.40);
      ">
        ${number}
      </div>
    `,

    iconSize: [
      36,
      36,
    ],

    iconAnchor: [
      18,
      18,
    ],
  });
}


// ============================================================
// TIMESTAMP
// ============================================================

function formatTimestamp(
  timestamp
) {
  if (!timestamp) {
    return "Unavailable";
  }

  const date =
    new Date(
      String(
        timestamp
      ).replace(
        " ",
        "T"
      )
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return timestamp;
  }

  return date
    .toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",
      }
    );
}


// ============================================================
// MAIN MAP
// ============================================================

function CityMap({
  heatmap = [],
  trajectories = [],
  selectedPlate = null,

  showCameras = true,

  // Existing prop retained.
  // It now controls ROAD DENSITY instead of circles.
  showHeatmap = true,

  showTrajectories = true,

  height = 520,
}) {
  const [
    roadNetwork,
    setRoadNetwork,
  ] = useState([]);

  const [
    roadStatus,
    setRoadStatus,
  ] = useState(
    "loading"
  );


  // ==========================================================
  // LOAD ROAD GEOMETRY
  // ==========================================================

  useEffect(() => {
    let cancelled =
      false;

    async function
    loadRoadNetwork() {
      try {
        setRoadStatus(
          "loading"
        );

        const response =
          await getRoadNetwork();

        if (
          !cancelled
        ) {
          setRoadNetwork(
            asArray(
              response.data
            )
          );

          setRoadStatus(
            "ready"
          );
        }
      } catch (error) {
        console.error(
          "Road network error:",
          error
        );

        if (
          !cancelled
        ) {
          setRoadNetwork(
            []
          );

          setRoadStatus(
            "fallback"
          );
        }
      }
    }

    loadRoadNetwork();

    return () => {
      cancelled =
        true;
    };
  }, []);


  // ==========================================================
  // CAMERA LOCATIONS
  // ==========================================================

  const cameraPoints =
    useMemo(
      () =>
        asArray(
          heatmap
        ).filter(
          validCoords
        ),

      [heatmap]
    );


  // ==========================================================
  // SEGMENT TRAFFIC COUNTS
  // ==========================================================

  const segmentCounts =
    useMemo(
      () =>
        buildSegmentCounts(
          trajectories
        ),

      [trajectories]
    );


  const maxSegmentCount =
    useMemo(() => {
      const values =
        Object.values(
          segmentCounts
        );

      if (
        values.length === 0
      ) {
        return 0;
      }

      return Math.max(
        ...values
      );
    }, [
      segmentCounts,
    ]);


  // ==========================================================
  // FILTER SELECTED PLATE
  // ==========================================================

  const visibleTrajectories =
    useMemo(() => {
      const list =
        asArray(
          trajectories
        ).filter(
          (trajectory) =>
            asArray(
              trajectory
                ?.route
            ).filter(
              validCoords
            ).length >=
            2
        );

      if (
        !selectedPlate
      ) {
        return [];
      }

      const normalized =
        String(
          selectedPlate
        ).toUpperCase();

      return list.filter(
        (trajectory) =>
          String(
            trajectory
              .plate
          ).toUpperCase() ===
          normalized
      );
    }, [
      trajectories,
      selectedPlate,
    ]);


  // ==========================================================
  // MAP BOUNDS
  // ==========================================================

  const boundPoints =
    useMemo(() => {
      const points =
        cameraPoints.map(
          (camera) => [
            Number(
              camera.lat
            ),

            Number(
              camera.lon
            ),
          ]
        );

      asArray(
        roadNetwork
      ).forEach(
        (road) => {
          points.push(
            ...normalizeRoadPoints(
              road.points
            )
          );
        }
      );

      visibleTrajectories
        .forEach(
          (
            trajectory
          ) => {
            points.push(
              ...buildRoadTrajectory(
                trajectory,
                roadNetwork
              )
            );
          }
        );

      return points;
    }, [
      cameraPoints,
      roadNetwork,
      visibleTrajectories,
    ]);


  // ==========================================================
  // OSRM STATUS
  // ==========================================================

  const osrmSegments =
    asArray(
      roadNetwork
    ).filter(
      (route) =>
        route.source ===
        "osrm"
    ).length;


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className=
        "city-map"

      style={{
        width:
          "100%",

        height,

        position:
          "relative",

        overflow:
          "hidden",

        borderRadius:
          "20px",
      }}
    >

      <MapContainer
        center={
          DEFAULT_CENTER
        }

        zoom={13}

        scrollWheelZoom

        className=
          "leaflet-host"

        style={{
          width:
            "100%",

          height:
            "100%",
        }}
      >

        {/* ====================================================
            MODERN BASE MAP
        ==================================================== */}

        <TileLayer
          attribution=
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

          url=
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEffects
          points={
            boundPoints
          }
        />


        {/* ====================================================
            ROAD TRAFFIC DENSITY
        ==================================================== */}

        {showHeatmap &&
          asArray(
            roadNetwork
          ).map(
            (
              road,
              index
            ) => {

              const roadPoints =
                normalizeRoadPoints(
                  road.points
                );

              if (
                roadPoints.length <
                2
              ) {
                return null;
              }

              const key =
                pairKey(
                  road.from_camera,
                  road.to_camera
                );

              const count =
                segmentCounts[
                  key
                ] || 0;

              const traffic =
                getRoadTrafficInfo(
                  count,
                  maxSegmentCount
                );

              return (
                <Polyline
                  key={`traffic-road-${index}`}

                  positions={
                    roadPoints
                  }

                  pathOptions={{
                    color:
                      traffic.color,

                    weight:
                      traffic.weight,

                    opacity:
                      0.72,

                    lineCap:
                      "round",

                    lineJoin:
                      "round",
                  }}
                >
                  <Popup>
                    <strong>
                      {
                        road.from_camera
                      }
                      {" → "}
                      {
                        road.to_camera
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          "6px",
                      }}
                    >
                      Traffic:
                      {" "}

                      <strong>
                        {
                          traffic.level
                        }
                      </strong>
                    </div>

                    <div>
                      Reconstructed vehicles:
                      {" "}
                      {
                        count
                      }
                    </div>

                    {road.distance_km !=
                      null && (
                      <div>
                        Road distance:
                        {" "}
                        {
                          road.distance_km
                        }
                        {" km"}
                      </div>
                    )}

                    <div>
                      Geometry:
                      {" "}
                      {
                        road.source ===
                        "osrm"
                          ? "Road network"
                          : "Fallback"
                      }
                    </div>
                  </Popup>
                </Polyline>
              );
            }
          )}


        {/* ====================================================
            SELECTED VEHICLE TRAJECTORY
        ==================================================== */}

        {showTrajectories &&
          visibleTrajectories.map(
            (
              trajectory
            ) => {

              const route =
                buildRoadTrajectory(
                  trajectory,
                  roadNetwork
                );

              if (
                route.length <
                2
              ) {
                return null;
              }

              const color =
                plateColor(
                  trajectory.plate
                );

              return (
                <>

                  {/* White outline makes selected route visible
                      above congestion roads */}

                  <Polyline
                    key={`selected-outline-${trajectory.plate}`}

                    positions={
                      route
                    }

                    pathOptions={{
                      color:
                        "#ffffff",

                      weight:
                        10,

                      opacity:
                        0.92,

                      lineCap:
                        "round",

                      lineJoin:
                        "round",
                    }}
                  />


                  <Polyline
                    key={`selected-route-${trajectory.plate}`}

                    positions={
                      route
                    }

                    pathOptions={{
                      color,

                      weight:
                        6,

                      opacity:
                        1,

                      lineCap:
                        "round",

                      lineJoin:
                        "round",
                    }}
                  >
                    <Popup>
                      <strong>
                        {
                          trajectory.plate
                        }
                      </strong>

                      <div>
                        Probable
                        reconstructed
                        road route
                      </div>

                      <div>
                        {asArray(
                          trajectory.route
                        )
                          .map(
                            (
                              point
                            ) =>
                              point.camera_id
                          )
                          .filter(
                            Boolean
                          )
                          .join(
                            " → "
                          )}
                      </div>
                    </Popup>
                  </Polyline>

                </>
              );
            }
          )}


        {/* ====================================================
            CAMERA MARKERS
        ==================================================== */}

        {showCameras &&
          cameraPoints.map(
            (
              camera
            ) => {

              return (
                <CircleMarker
                  key={`camera-${camera.camera_id}`}

                  center={[
                    Number(
                      camera.lat
                    ),

                    Number(
                      camera.lon
                    ),
                  ]}

                  radius={8}

                  pathOptions={{
                    color:
                      "#ffffff",

                    fillColor:
                      "#2563eb",

                    fillOpacity:
                      1,

                    weight:
                      3,
                  }}
                >
                  <Tooltip
                    permanent

                    direction=
                      "top"

                    offset={[
                      0,
                      -10,
                    ]}
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
                      Unique plates:
                      {" "}
                      {
                        camera.vehicle_count ??
                        0
                      }
                    </div>

                    <div>
                      {Number(
                        camera.lat
                      ).toFixed(
                        4
                      )}
                      ,
                      {" "}
                      {Number(
                        camera.lon
                      ).toFixed(
                        4
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            }
          )}


        {/* ====================================================
            NUMBERED OBSERVATIONS
        ==================================================== */}

        {showTrajectories &&
          visibleTrajectories.flatMap(
            (
              trajectory
            ) => {

              const color =
                plateColor(
                  trajectory.plate
                );

              return asArray(
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

                    <Marker
                      key={`${trajectory.plate}-${point.camera_id}-${index}`}

                      position={[
                        Number(
                          point.lat
                        ),

                        Number(
                          point.lon
                        ),
                      ]}

                      icon={
                        createNumberIcon(
                          index +
                            1,

                          color
                        )
                      }
                    >

                      <Tooltip
                        direction=
                          "right"

                        offset={[
                          18,
                          0,
                        ]}
                      >
                        <strong>
                          {
                            index +
                            1
                          }
                          .
                          {" "}
                          {
                            point.camera_id
                          }
                        </strong>

                        <br />

                        {
                          formatTimestamp(
                            point.timestamp
                          )
                        }
                      </Tooltip>


                      <Popup>
                        <strong>
                          {
                            trajectory.plate
                          }
                        </strong>

                        <div>
                          Observation #
                          {
                            index +
                            1
                          }
                        </div>

                        <div>
                          Camera:
                          {" "}
                          {
                            point.camera_id
                          }
                        </div>

                        <div>
                          Time:
                          {" "}
                          {
                            point.timestamp
                          }
                        </div>
                      </Popup>

                    </Marker>

                  )
                );
            }
          )}

      </MapContainer>


      {/* ======================================================
          ROAD DENSITY LEGEND
      ====================================================== */}

      <div
        style={{
          position:
            "absolute",

          bottom:
            "24px",

          left:
            "24px",

          zIndex:
            1000,

          background:
            "rgba(15,23,42,.94)",

          border:
            "1px solid rgba(148,163,184,.18)",

          borderRadius:
            "12px",

          color:
            "#e2e8f0",

          padding:
            "12px 16px",

          boxShadow:
            "0 8px 24px rgba(0,0,0,.25)",

          fontSize:
            "13px",
        }}
      >

        <div
          style={{
            fontWeight:
              700,

            marginBottom:
              "8px",
          }}
        >
          Road Traffic Density
        </div>


        <div
          style={{
            display:
              "flex",

            gap:
              "15px",
          }}
        >

          <span>
            🟢 Low
          </span>

          <span>
            🟠 Moderate
          </span>

          <span>
            🔴 High
          </span>

        </div>

      </div>


      {/* ======================================================
          INFO PANEL
      ====================================================== */}

      <div
        style={{
          position:
            "absolute",

          top:
            "18px",

          right:
            "18px",

          zIndex:
            1000,

          maxWidth:
            "315px",

          background:
            "rgba(15,23,42,.94)",

          color:
            "#e2e8f0",

          padding:
            "11px 15px",

          borderRadius:
            "12px",

          border:
            "1px solid rgba(148,163,184,.18)",

          boxShadow:
            "0 8px 25px rgba(0,0,0,.22)",

          fontSize:
            "12px",
        }}
      >

        <strong>
          {selectedPlate
            ? selectedPlate
            : "UrbanSight Road Intelligence"}
        </strong>


        <div
          style={{
            color:
              "#94a3b8",

            marginTop:
              "5px",

            lineHeight:
              1.45,
          }}
        >

          {roadStatus ===
          "loading"
            ? "Loading road network..."

            : osrmSegments >
                0

              ? selectedPlate

                ? "Highlighted path is a probable road-network trajectory reconstructed between confirmed ANPR observations."

                : "Road colors represent relative traffic volume derived from reconstructed vehicle trajectories."

              : "Road routing service unavailable. Some paths may use direct camera links."}

        </div>

      </div>

    </div>
  );
}

export default CityMap;