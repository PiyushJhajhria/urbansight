import {
  AlertTriangle,
  Ban,
  Camera,
  Clock3,
  Gauge,
  MapPin,
  Route,
  ShieldAlert,
} from "lucide-react";

import {
  alertLocation,
  alertPlate,
  alertSeverity,
  alertTimestamp,
  formatAlertType,
} from "../utils/data";


// ============================================================
// ALERT ICON
// ============================================================

function AlertTypeIcon({
  type,
  size,
}) {
  if (
    type ===
    "BLACKLIST_MATCH"
  ) {
    return (
      <Ban size={size} />
    );
  }

  if (
    type ===
    "IMPOSSIBLE_SPEED"
  ) {
    return (
      <Gauge size={size} />
    );
  }

  if (
    type ===
    "RESTRICTED_ROUTE"
  ) {
    return (
      <ShieldAlert
        size={size}
      />
    );
  }

  return (
    <AlertTriangle
      size={size}
    />
  );
}


// ============================================================
// HUMAN-READABLE EXPLANATION
// ============================================================

function getAlertExplanation(
  alert
) {
  const type =
    alert?.type;


  if (
    type ===
    "BLACKLIST_MATCH"
  ) {
    const plate =
      alertPlate(alert) ||
      "This vehicle";

    const camera =
      alert?.camera_id;

    if (camera) {
      return `${plate} matched the configured watchlist and was detected at ${camera}.`;
    }

    return `${plate} matched a vehicle on the configured watchlist.`;
  }


  if (
    type ===
    "IMPOSSIBLE_SPEED"
  ) {
    const speed =
      Number(
        alert
          ?.required_speed_kmph
      );


    const from =
      alert?.from_camera;


    const to =
      alert?.to_camera;


    if (
      Number.isFinite(speed) &&
      from &&
      to
    ) {
      return `The vehicle would need to travel approximately ${speed.toFixed(
        1
      )} km/h to move from ${from} to ${to} within the observed time interval.`;
    }


    if (
      Number.isFinite(speed)
    ) {
      return `The reconstructed journey requires approximately ${speed.toFixed(
        1
      )} km/h, exceeding the configured feasibility threshold.`;
    }


    return "The time and distance between consecutive ANPR observations produced an implausible travel speed.";
  }


  if (
    type ===
    "RESTRICTED_ROUTE"
  ) {
    const from =
      alert?.from_camera;


    const to =
      alert?.to_camera;


    if (
      from &&
      to
    ) {
      return `The reconstructed trajectory contains the configured restricted movement ${from} → ${to}.`;
    }


    return "The reconstructed vehicle trajectory contains a route transition configured as restricted.";
  }


  return "The traffic intelligence engine flagged this event for operator review.";
}


// ============================================================
// ALERT SOURCE
// ============================================================

function getDetectionMethod(
  type
) {
  if (
    type ===
    "BLACKLIST_MATCH"
  ) {
    return "Watchlist matching";
  }

  if (
    type ===
    "IMPOSSIBLE_SPEED"
  ) {
    return "Spatio-temporal validation";
  }

  if (
    type ===
    "RESTRICTED_ROUTE"
  ) {
    return "Trajectory rule engine";
  }

  return "Traffic intelligence";
}


// ============================================================
// ALERT CARD
// ============================================================

function AlertCard({
  alert,
  compact = false,
}) {
  const type =
    alert?.type;


  const severity =
    alertSeverity(
      type
    );


  const plate =
    alertPlate(
      alert
    );


  const timestamp =
    alertTimestamp(
      alert
    );


  const location =
    alertLocation(
      alert
    );


  const explanation =
    getAlertExplanation(
      alert
    );


  const detectionMethod =
    getDetectionMethod(
      type
    );


  // ==========================================================
  // COMPACT VERSION
  // Used on overview dashboard.
  // ==========================================================

  if (compact) {
    return (
      <article
        className={`alert-item tone-${severity.tone}`}
      >

        <div
          className=
            "alert-icon"
        >
          <AlertTypeIcon
            type={type}
            size={16}
          />
        </div>


        <div
          className=
            "alert-information"
        >

          <strong>
            {
              formatAlertType(
                type
              )
            }
          </strong>


          <p>
            {plate ||
              "Vehicle event"}
          </p>


          <span>
            {location}
          </span>


          {timestamp ? (
            <span
              className=
                "alert-time"
            >
              {timestamp}
            </span>
          ) : null}

        </div>


        <div
          className={`severity-badge ${severity.tone}`}
        >
          {severity.label}
        </div>

      </article>
    );
  }


  // ==========================================================
  // FULL SECURITY-INTELLIGENCE CARD
  // ==========================================================

  return (
    <article
      className={`alert-item alert-item-large tone-${severity.tone}`}
      style={{
        padding:
          "20px",

        alignItems:
          "flex-start",
      }}
    >

      {/* ======================================================
          ICON
      ====================================================== */}

      <div
        className=
          "alert-icon"
        style={{
          marginTop:
            "2px",
        }}
      >
        <AlertTypeIcon
          type={type}
          size={20}
        />
      </div>


      {/* ======================================================
          CONTENT
      ====================================================== */}

      <div
        className=
          "alert-information"

        style={{
          flex:
            1,

          minWidth:
            0,
        }}
      >

        {/* HEADER */}

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap:
              "14px",

            flexWrap:
              "wrap",
          }}
        >

          <div>

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "9px",

                flexWrap:
                  "wrap",
              }}
            >

              <strong
                style={{
                  fontSize:
                    "16px",
                }}
              >
                {
                  formatAlertType(
                    type
                  )
                }
              </strong>


              <span
                style={{
                  padding:
                    "3px 8px",

                  borderRadius:
                    "999px",

                  background:
                    "rgba(148,163,184,.10)",

                  color:
                    "#94a3b8",

                  fontSize:
                    "10px",

                  fontWeight:
                    700,

                  letterSpacing:
                    ".04em",

                  textTransform:
                    "uppercase",
                }}
              >
                {detectionMethod}
              </span>

            </div>


            <p
              style={{
                marginTop:
                  "7px",

                fontSize:
                  "20px",

                fontWeight:
                  800,

                letterSpacing:
                  ".04em",
              }}
            >
              {plate ||
                "Vehicle event"}
            </p>

          </div>


          <div
            className={`severity-badge ${severity.tone}`}
          >
            {severity.label}
          </div>

        </div>


        {/* ====================================================
            LOCATION / TIME
        ==================================================== */}

        <div
          style={{
            display:
              "flex",

            flexWrap:
              "wrap",

            gap:
              "10px 18px",

            marginTop:
              "13px",

            color:
              "#94a3b8",

            fontSize:
              "12px",
          }}
        >

          {location ? (
            <span
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "6px",
              }}
            >
              <MapPin
                size={14}
              />

              {location}
            </span>
          ) : null}


          {alert?.camera_id ? (
            <span
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "6px",
              }}
            >
              <Camera
                size={14}
              />

              {
                alert.camera_id
              }
            </span>
          ) : null}


          {timestamp ? (
            <span
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "6px",
              }}
            >
              <Clock3
                size={14}
              />

              {timestamp}
            </span>
          ) : null}

        </div>


        {/* ====================================================
            WHY FLAGGED
        ==================================================== */}

        <div
          style={{
            marginTop:
              "16px",

            padding:
              "13px 15px",

            borderRadius:
              "11px",

            background:
              "rgba(15,23,42,.45)",

            border:
              "1px solid rgba(148,163,184,.12)",
          }}
        >

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "7px",

              marginBottom:
                "6px",

              color:
                "#cbd5e1",

              fontSize:
                "11px",

              fontWeight:
                800,

              textTransform:
                "uppercase",

              letterSpacing:
                ".05em",
            }}
          >
            <AlertTriangle
              size={13}
            />

            Why this was flagged
          </div>


          <div
            style={{
              color:
                "#94a3b8",

              fontSize:
                "13px",

              lineHeight:
                1.55,
            }}
          >
            {explanation}
          </div>

        </div>


        {/* ====================================================
            TECHNICAL EVIDENCE
        ==================================================== */}

        <div
          className=
            "alert-meta"

          style={{
            marginTop:
              "13px",
          }}
        >

          {alert?.from_camera ? (
            <em>
              <Route
                size={11}
              />
              {" "}
              From{" "}
              {
                alert.from_camera
              }
            </em>
          ) : null}


          {alert?.to_camera ? (
            <em>
              To{" "}
              {
                alert.to_camera
              }
            </em>
          ) : null}


          {alert
              ?.required_speed_kmph !=
            null ? (

            <em>
              <Gauge
                size={11}
              />
              {" "}
              {
                Number(
                  alert
                    .required_speed_kmph
                ).toFixed(
                  1
                )
              }
              {" km/h required"}
            </em>

          ) : null}


          {alert?.similarity !=
          null ? (

            <em>
              Match confidence{" "}
              {
                Number(
                  alert.similarity
                ).toFixed(
                  2
                )
              }
            </em>

          ) : null}


          {alert?.matched_with ? (
            <em>
              Watchlist match{" "}
              {
                alert.matched_with
              }
            </em>
          ) : null}


          {alert?.anomaly_type ? (
            <em>
              {
                alert.anomaly_type
              }
            </em>
          ) : null}

        </div>

      </div>

    </article>
  );
}


export default AlertCard;