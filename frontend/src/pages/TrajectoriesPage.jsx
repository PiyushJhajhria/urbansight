import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Camera,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  Route,
  Search,
} from "lucide-react";

import {
  getRoadNetwork,
  getVehicleTrajectory,
  searchPlate,
} from "../api";

import CityMap from "../components/CityMap";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingBlock from "../components/LoadingBlock";
import PageHeader from "../components/PageHeader";
import TrajectoryRow from "../components/TrajectoryRow";

import {
  useDashboard,
} from "../context/DashboardContext";

import {
  asArray,
  lastTimestamp,
  routeCameras,
} from "../utils/data";


// ============================================================
// PROTOTYPE CAMERA DISTANCES
// ============================================================
//
// These are the distances already used by the prototype's
// trajectory / speed logic.
//
// If road-network distance is available from /roads/network,
// that value is preferred for display.
//

const FALLBACK_DISTANCES = {
  "CAM_01-CAM_02": 4,
  "CAM_02-CAM_03": 6,
  "CAM_01-CAM_03": 9,
};


// ============================================================
// HELPERS
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


function parseTimestamp(
  timestamp
) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(
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
    return null;
  }

  return date;
}


function formatTime(
  timestamp
) {
  if (!timestamp) {
    return "Unknown";
  }

  const date =
    parseTimestamp(
      timestamp
    );

  if (!date) {
    return timestamp;
  }

  return date.toLocaleTimeString(
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


function formatDateTime(
  timestamp
) {
  if (!timestamp) {
    return "Unknown";
  }

  const date =
    parseTimestamp(
      timestamp
    );

  if (!date) {
    return timestamp;
  }

  return date.toLocaleString(
    [],
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",
    }
  );
}


function formatDuration(
  seconds
) {
  if (
    seconds == null ||
    seconds < 0
  ) {
    return "Unavailable";
  }

  const rounded =
    Math.round(
      seconds
    );

  const hours =
    Math.floor(
      rounded /
      3600
    );

  const minutes =
    Math.floor(
      (
        rounded %
        3600
      ) /
      60
    );

  const remainingSeconds =
    rounded %
    60;

  if (hours > 0) {
    return (
      `${hours}h ` +
      `${minutes}m ` +
      `${remainingSeconds}s`
    );
  }

  if (minutes > 0) {
    return (
      `${minutes}m ` +
      `${remainingSeconds}s`
    );
  }

  return `${remainingSeconds}s`;
}


// ============================================================
// ROAD DISTANCE LOOKUP
// ============================================================

function buildRoadDistanceMap(
  roadNetwork
) {
  const map = {};

  asArray(
    roadNetwork
  ).forEach(
    (road) => {
      const from =
        road?.from_camera;

      const to =
        road?.to_camera;

      const distance =
        Number(
          road?.distance_km
        );

      if (
        !from ||
        !to ||
        !Number.isFinite(
          distance
        ) ||
        distance <= 0
      ) {
        return;
      }

      map[
        pairKey(
          from,
          to
        )
      ] = {
        distance,
        source:
          road.source ||
          "unknown",
      };
    }
  );

  return map;
}


// ============================================================
// JOURNEY METRICS
// ============================================================

function calculateJourneyMetrics(
  trajectory,
  roadNetwork
) {
  const route =
    asArray(
      trajectory?.route
    );

  if (
    route.length === 0
  ) {
    return {
      firstSeen:
        null,

      lastSeen:
        null,

      journeySeconds:
        null,

      uniqueCameras:
        0,

      observations:
        0,

      totalDistanceKm:
        null,

      averageSpeedKmph:
        null,

      distanceSource:
        "Unavailable",
    };
  }


  // ----------------------------------------------------------
  // SORT OBSERVATIONS CHRONOLOGICALLY
  // ----------------------------------------------------------

  const orderedRoute = [
    ...route,
  ].sort(
    (a, b) => {
      const first =
        parseTimestamp(
          a.timestamp
        );

      const second =
        parseTimestamp(
          b.timestamp
        );

      if (
        !first ||
        !second
      ) {
        return 0;
      }

      return (
        first -
        second
      );
    }
  );


  const firstSeen =
    orderedRoute[0]
      ?.timestamp ||
    null;


  const lastSeen =
    orderedRoute[
      orderedRoute.length -
      1
    ]
      ?.timestamp ||
    null;


  const firstDate =
    parseTimestamp(
      firstSeen
    );


  const lastDate =
    parseTimestamp(
      lastSeen
    );


  const journeySeconds =
    firstDate &&
    lastDate

      ? (
          lastDate -
          firstDate
        ) /
        1000

      : null;


  const uniqueCameras =
    new Set(
      orderedRoute
        .map(
          (point) =>
            point.camera_id
        )
        .filter(
          Boolean
        )
    ).size;


  // ----------------------------------------------------------
  // ROAD DISTANCES
  // ----------------------------------------------------------

  const roadDistances =
    buildRoadDistanceMap(
      roadNetwork
    );


  let totalDistance =
    0;


  let segmentCount =
    0;


  let roadSegmentCount =
    0;


  let fallbackSegmentCount =
    0;


  for (
    let index = 0;
    index <
    orderedRoute.length - 1;
    index += 1
  ) {
    const current =
      orderedRoute[index];

    const next =
      orderedRoute[
        index + 1
      ];


    const from =
      current
        ?.camera_id;

    const to =
      next
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


    const roadInfo =
      roadDistances[
        key
      ];


    if (
      roadInfo &&
      Number.isFinite(
        roadInfo.distance
      )
    ) {
      totalDistance +=
        roadInfo.distance;

      segmentCount +=
        1;

      if (
        roadInfo.source ===
        "osrm"
      ) {
        roadSegmentCount +=
          1;
      } else {
        fallbackSegmentCount +=
          1;
      }

      continue;
    }


    const fallback =
      FALLBACK_DISTANCES[
        key
      ];


    if (
      Number.isFinite(
        fallback
      )
    ) {
      totalDistance +=
        fallback;

      segmentCount +=
        1;

      fallbackSegmentCount +=
        1;
    }
  }


  const totalDistanceKm =
    segmentCount > 0

      ? Number(
          totalDistance
            .toFixed(
              2
            )
        )

      : null;


  const averageSpeedKmph =
    totalDistanceKm != null &&
    journeySeconds != null &&
    journeySeconds > 0

      ? Number(
          (
            totalDistanceKm /
            (
              journeySeconds /
              3600
            )
          ).toFixed(
            1
          )
        )

      : null;


  let distanceSource =
    "Prototype camera distances";


  if (
    roadSegmentCount > 0 &&
    fallbackSegmentCount === 0
  ) {
    distanceSource =
      "Road-network distance";
  } else if (
    roadSegmentCount > 0
  ) {
    distanceSource =
      "Mixed road + prototype distances";
  }


  return {
    firstSeen,

    lastSeen,

    journeySeconds,

    uniqueCameras,

    observations:
      orderedRoute.length,

    totalDistanceKm,

    averageSpeedKmph,

    distanceSource,
  };
}


// ============================================================
// METRIC CARD
// ============================================================

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}) {
  return (
    <div
      style={{
        minHeight:
          "110px",

        padding:
          "18px",

        borderRadius:
          "16px",

        border:
          "1px solid rgba(148,163,184,.16)",

        background:
          "rgba(15,23,42,.52)",

        display:
          "flex",

        flexDirection:
          "column",

        justifyContent:
          "space-between",

        gap:
          "10px",
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          gap:
            "8px",

          color:
            "#94a3b8",

          fontSize:
            "12px",

          fontWeight:
            700,

          textTransform:
            "uppercase",

          letterSpacing:
            ".05em",
        }}
      >
        <Icon
          size={16}
        />

        {label}
      </div>


      <div>
        <div
          style={{
            color:
              "#f8fafc",

            fontSize:
              "21px",

            lineHeight:
              1.15,

            fontWeight:
              800,
          }}
        >
          {value}
        </div>

        {hint ? (
          <div
            style={{
              marginTop:
                "6px",

              color:
                "#64748b",

              fontSize:
                "12px",

              lineHeight:
                1.4,
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}


// ============================================================
// TRAJECTORY TIMELINE
// ============================================================

function TrajectoryTimeline({
  route,
}) {
  const points =
    asArray(
      route
    );


  if (
    points.length === 0
  ) {
    return (
      <EmptyState
        title="Trajectory not found"
        message="No ordered camera observations were returned for this plate."
      />
    );
  }


  return (
    <div
      style={{
        display:
          "flex",

        flexDirection:
          "column",
      }}
    >
      {points.map(
        (
          point,
          index
        ) => {
          const isLast =
            index ===
            points.length -
              1;


          return (
            <div
              key={`${point.camera_id}-${point.timestamp}-${index}`}

              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "44px 1fr",

                minHeight:
                  isLast
                    ? "65px"
                    : "92px",
              }}
            >

              {/* LEFT TIMELINE */}

              <div
                style={{
                  position:
                    "relative",

                  display:
                    "flex",

                  justifyContent:
                    "center",
                }}
              >
                <div
                  style={{
                    width:
                      "32px",

                    height:
                      "32px",

                    borderRadius:
                      "50%",

                    background:
                      "#2563eb",

                    border:
                      "3px solid #dbeafe",

                    color:
                      "white",

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "center",

                    fontWeight:
                      800,

                    zIndex:
                      2,
                  }}
                >
                  {index + 1}
                </div>


                {!isLast ? (
                  <div
                    style={{
                      position:
                        "absolute",

                      top:
                        "31px",

                      bottom:
                        "-1px",

                      width:
                        "3px",

                      borderRadius:
                        "999px",

                      background:
                        "linear-gradient(#3b82f6,#334155)",
                    }}
                  />
                ) : null}

              </div>


              {/* RIGHT CONTENT */}

              <div
                style={{
                  padding:
                    "2px 0 18px 8px",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    gap:
                      "12px",

                    flexWrap:
                      "wrap",
                  }}
                >
                  <strong
                    style={{
                      color:
                        "#f8fafc",

                      fontSize:
                        "16px",
                    }}
                  >
                    {
                      point.camera_id ||
                      "Unknown camera"
                    }
                  </strong>


                  <span
                    style={{
                      color:
                        "#94a3b8",

                      fontSize:
                        "13px",
                    }}
                  >
                    {
                      formatTime(
                        point.timestamp
                      )
                    }
                  </span>
                </div>


                <div
                  style={{
                    marginTop:
                      "5px",

                    color:
                      "#64748b",

                    fontSize:
                      "12px",
                  }}
                >
                  Confirmed ANPR observation
                </div>


                {point.plate_read ? (
                  <div
                    style={{
                      marginTop:
                        "6px",

                      color:
                        "#cbd5e1",

                      fontSize:
                        "12px",
                    }}
                  >
                    OCR reading:{" "}

                    <strong>
                      {
                        point.plate_read
                      }
                    </strong>
                  </div>
                ) : null}

              </div>

            </div>
          );
        }
      )}
    </div>
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

function TrajectoriesPage() {
  const {
    trajectories,
    heatmap,
  } = useDashboard();


  const [
    query,
    setQuery,
  ] = useState("");


  const [
    searching,
    setSearching,
  ] = useState(
    false
  );


  const [
    searchError,
    setSearchError,
  ] = useState(
    null
  );


  const [
    result,
    setResult,
  ] = useState(
    null
  );


  const [
    roadNetwork,
    setRoadNetwork,
  ] = useState([]);


  // ==========================================================
  // LOAD ROAD DISTANCES
  // ==========================================================

  useEffect(() => {
    let cancelled =
      false;


    async function
    loadRoadData() {
      try {
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
        }
      } catch {
        if (
          !cancelled
        ) {
          setRoadNetwork(
            []
          );
        }
      }
    }


    loadRoadData();


    return () => {
      cancelled =
        true;
    };
  }, []);


  // ==========================================================
  // MAP CAMERA FILTER
  // ==========================================================

  const selectedHeatmap =
    useMemo(() => {
      const route =
        asArray(
          result
            ?.trajectory
            ?.route
        );


      if (
        !route.length
      ) {
        return heatmap;
      }


      const cameras =
        new Set(
          route.map(
            (point) =>
              point.camera_id
          )
        );


      const filtered =
        heatmap.filter(
          (item) =>
            cameras.has(
              item.camera_id
            )
        );


      return (
        filtered.length
          ? filtered
          : heatmap
      );
    }, [
      heatmap,
      result,
    ]);


  // ==========================================================
  // SEARCH
  // ==========================================================

  async function runSearch(
    plateValue
  ) {
    const plate =
      String(
        plateValue ||
        ""
      ).trim();


    if (!plate) {
      return;
    }


    setQuery(
      plate
    );


    setSearching(
      true
    );


    setSearchError(
      null
    );


    try {
      const [
        plateResponse,
        trajectoryResponse,
      ] =
        await Promise.all([
          searchPlate(
            plate
          ),

          getVehicleTrajectory(
            plate
          ),
        ]);


      const events =
        asArray(
          plateResponse
            .data
            ?.events
        );


      const trajectory =
        trajectoryResponse
          .data
          ?.route

          ? trajectoryResponse
              .data

          : null;


      const notFound =
        events.length === 0 &&
        !trajectory;


      setResult({
        plate:
          plateResponse
            .data
            ?.plate ||
          plate.toUpperCase(),

        events,

        trajectory,

        message:
          trajectoryResponse
            .data
            ?.message ||
          null,

        notFound,
      });

    } catch {
      setResult(
        null
      );


      setSearchError(
        "Plate lookup failed. Confirm the backend is running and the plate endpoints are reachable."
      );

    } finally {
      setSearching(
        false
      );
    }
  }


  function onSubmit(
    event
  ) {
    event.preventDefault();

    runSearch(
      query
    );
  }


  // ==========================================================
  // SEARCH RESULT DERIVED DATA
  // ==========================================================

  const cameras =
    routeCameras(
      result
        ?.trajectory
    );


  const ocrReadings =
    asArray(
      result
        ?.trajectory
        ?.route
    ).filter(
      (point) =>
        point.plate_read
    );


  const journeyMetrics =
    useMemo(
      () =>
        calculateJourneyMetrics(
          result
            ?.trajectory,

          roadNetwork
        ),

      [
        result,
        roadNetwork,
      ]
    );


  const route =
    asArray(
      result
        ?.trajectory
        ?.route
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section
      className=
        "page-section"
    >

      <PageHeader
        eyebrow=
          "Multi-camera ANPR"

        title=
          "Vehicle trajectories"

        description=
          "Query a plate, inspect confirmed ANPR observations, and reconstruct its probable movement across the city camera network."
      />


      {/* ======================================================
          SEARCH
      ====================================================== */}

      <form
        className=
          "search-panel"

        onSubmit={
          onSubmit
        }
      >
        <Search
          size={18}
        />

        <input
          value={
            query
          }

          onChange={
            (
              event
            ) =>
              setQuery(
                event
                  .target
                  .value
              )
          }

          placeholder=
            "Search plate number, e.g. DL3CAB9876"

          aria-label=
            "Plate number"
        />

        <button
          type=
            "submit"
        >
          Search vehicle
        </button>
      </form>


      <ErrorBanner
        message={
          searchError
        }
      />


      {searching ? (
        <LoadingBlock
          label=
            "Reconstructing vehicle journey..."
        />
      ) : null}


      {/* ======================================================
          RESULT
      ====================================================== */}

      {result &&
      !searching ? (
        <div
          className=
            "panel search-result"
        >

          {result.notFound ? (

            <EmptyState
              title=
                "Plate not found"

              message={`No events or reconstructed trajectory were found for ${result.plate}.`}
            />

          ) : (

            <>

              {/* ==================================================
                  VEHICLE HERO
              ================================================== */}

              <div
                className=
                  "result-hero"
              >

                <div>
                  <p
                    className=
                      "panel-eyebrow"
                  >
                    Matched vehicle
                  </p>


                  <h2
                    className=
                      "plate-display"
                  >
                    {
                      result.plate
                    }
                  </h2>


                  <p>
                    Last confirmed observation{" "}

                    <strong>
                      {
                        formatDateTime(
                          journeyMetrics.lastSeen ||
                          result.events[
                            result.events.length -
                            1
                          ]
                            ?.timestamp
                        )
                      }
                    </strong>
                  </p>
                </div>


                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "8px",

                    flexWrap:
                      "wrap",
                  }}
                >
                  <span
                    className=
                      "trajectory-count"
                  >
                    {
                      journeyMetrics
                        .uniqueCameras
                    }
                    {" "}
                    cameras
                  </span>


                  <span
                    className=
                      "trajectory-count"
                  >
                    {
                      journeyMetrics
                        .observations
                    }
                    {" "}
                    observations
                  </span>
                </div>

              </div>


              {/* ==================================================
                  INTELLIGENCE METRICS
              ================================================== */}

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(170px, 1fr))",

                  gap:
                    "12px",

                  margin:
                    "20px 0 26px",
                }}
              >

                <MetricCard
                  icon={
                    Clock3
                  }

                  label=
                    "First seen"

                  value={
                    formatTime(
                      journeyMetrics
                        .firstSeen
                    )
                  }

                  hint={
                    journeyMetrics
                      .firstSeen

                      ? formatDateTime(
                          journeyMetrics
                            .firstSeen
                        )

                      : "No confirmed timestamp"
                  }
                />


                <MetricCard
                  icon={
                    MapPin
                  }

                  label=
                    "Last seen"

                  value={
                    formatTime(
                      journeyMetrics
                        .lastSeen
                    )
                  }

                  hint={
                    journeyMetrics
                      .lastSeen

                      ? formatDateTime(
                          journeyMetrics
                            .lastSeen
                        )

                      : "No confirmed timestamp"
                  }
                />


                <MetricCard
                  icon={
                    Camera
                  }

                  label=
                    "Cameras crossed"

                  value={
                    journeyMetrics
                      .uniqueCameras
                  }

                  hint=
                    "Unique ANPR camera nodes"
                />


                <MetricCard
                  icon={
                    Navigation
                  }

                  label=
                    "Journey time"

                  value={
                    formatDuration(
                      journeyMetrics
                        .journeySeconds
                    )
                  }

                  hint=
                    "First to last confirmed sighting"
                />


                <MetricCard
                  icon={
                    Route
                  }

                  label=
                    "Distance"

                  value={
                    journeyMetrics
                      .totalDistanceKm !=
                    null

                      ? `${journeyMetrics.totalDistanceKm} km`

                      : "Unavailable"
                  }

                  hint={
                    journeyMetrics
                      .distanceSource
                  }
                />


                <MetricCard
                  icon={
                    Gauge
                  }

                  label=
                    "Journey avg. speed"

                  value={
                    journeyMetrics
                      .averageSpeedKmph !=
                    null

                      ? `${journeyMetrics.averageSpeedKmph} km/h`

                      : "Unavailable"
                  }

                  hint=
                    "Estimated across camera-to-camera journey"
                />

              </div>


              {/* ==================================================
                  QUICK CAMERA FLOW
              ================================================== */}

              <div
                className=
                  "route-flow large"
              >

                {cameras.length ===
                0 ? (

                  <span
                    className=
                      "muted"
                  >
                    No ordered camera path available.
                  </span>

                ) : (

                  cameras.map(
                    (
                      cameraId,
                      index
                    ) => (

                      <div
                        className=
                          "route-node"

                        key={`${cameraId}-${index}`}
                      >

                        <span>
                          {
                            cameraId
                          }
                        </span>


                        {index <
                        cameras.length -
                          1 ? (

                          <div
                            className=
                              "route-line"
                          />

                        ) : null}

                      </div>

                    )
                  )

                )}

              </div>


              {/* ==================================================
                  TIMELINE + RAW READINGS
              ================================================== */}

              <div
                className=
                  "split-grid"
              >

                {/* LEFT */}

                <div>
                  <h3
                    className=
                      "subhead"
                  >
                    Confirmed journey timeline
                  </h3>


                  <TrajectoryTimeline
                    route={
                      route
                    }
                  />
                </div>


                {/* RIGHT */}

                <div>
                  <h3
                    className=
                      "subhead"
                  >
                    ANPR / OCR evidence
                  </h3>


                  <div
                    className=
                      "detail-list"
                  >

                    {result
                        .events
                        .length ===
                      0 &&
                    ocrReadings
                        .length ===
                      0 ? (

                      <EmptyState
                        title=
                          "No OCR rows"

                        message=
                          "No individual recognition events were returned for this plate."
                      />

                    ) : (

                      (
                        result
                          .events
                          .length

                          ? result
                              .events

                          : ocrReadings
                      ).map(
                        (
                          event,
                          index
                        ) => (

                          <div
                            className=
                              "detail-row"

                            key={`${event.camera_id}-${event.timestamp}-${index}`}
                          >

                            <strong>
                              {
                                event.plate ||
                                event.plate_read ||
                                result.plate
                              }
                            </strong>


                            <span>
                              {
                                event.camera_id
                              }
                              {" · "}
                              {
                                event.timestamp ||
                                "No timestamp"
                              }
                            </span>


                            {event.track_id !=
                            null ? (

                              <em>
                                Track{" "}
                                {
                                  event.track_id
                                }
                              </em>

                            ) : null}

                          </div>

                        )
                      )

                    )}

                  </div>
                </div>

              </div>


              {/* ==================================================
                  MAP
              ================================================== */}

              {route.some(
                (point) =>
                  point.lat !=
                    null &&
                  point.lon !=
                    null
              ) ? (

                <div
                  className=
                    "result-map"
                >

                  <h3
                    className=
                      "subhead"
                  >
                    GIS trajectory reconstruction
                  </h3>


                  <p
                    style={{
                      color:
                        "#94a3b8",

                      fontSize:
                        "13px",

                      marginBottom:
                        "12px",
                    }}
                  >
                    Numbered markers are confirmed ANPR sightings. The path between cameras is a probable road-network reconstruction, not continuous GPS tracking.
                  </p>


                  <CityMap
                    heatmap={
                      selectedHeatmap
                    }

                    trajectories={[
                      result
                        .trajectory,
                    ]}

                    selectedPlate={
                      result.plate
                    }

                    height={
                      420
                    }
                  />

                </div>

              ) : null}

            </>

          )}

        </div>

      ) : null}


      {/* ======================================================
          ALL TRAJECTORIES
      ====================================================== */}

      <div
        className=
          "panel"
      >

        <div
          className=
            "panel-header"
        >

          <div>
            <p
              className=
                "panel-eyebrow"
            >
              Tracked vehicles
            </p>

            <h2>
              All reconstructed trajectories
            </h2>
          </div>


          <span
            className=
              "trajectory-count"
          >
            {
              trajectories.length
            }
            {" "}
            tracked
          </span>

        </div>


        <div
          className=
            "trajectory-table"
        >

          {trajectories.length ===
          0 ? (

            <EmptyState
              title=
                "No trajectories"

              message=
                "GET /trajectories returned an empty list."
            />

          ) : (

            trajectories.map(
              (
                trajectory
              ) => (

                <TrajectoryRow
                  key={
                    trajectory.plate
                  }

                  trajectory={
                    trajectory
                  }

                  onSelect={
                    runSearch
                  }
                />

              )
            )

          )}

        </div>

      </div>

    </section>
  );
}


export default TrajectoriesPage;