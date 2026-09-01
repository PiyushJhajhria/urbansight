import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getAlerts,
  getCounts,
  getHeatmap,
  getOD,
  getSpeeds,
  getTrajectories,
} from "../api";

import {
  asArray,
  average,
} from "../utils/data";


const DashboardContext =
  createContext(null);


const API_BASE =
  "http://127.0.0.1:8000";


const POLL_INTERVAL_MS =
  5000;


// ============================================================
// PLATE NORMALIZATION
// ============================================================

function normalizePlate(
  value
) {
  return String(
    value || ""
  )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}


// ============================================================
// PROVIDER
// ============================================================

export function DashboardProvider({
  children,
}) {

  const [events, setEvents] =
    useState([]);

  const [counts, setCounts] =
    useState([]);

  const [speeds, setSpeeds] =
    useState([]);

  const [alerts, setAlerts] =
    useState([]);

  const [
    trajectories,
    setTrajectories,
  ] = useState([]);

  const [odFlows, setOdFlows] =
    useState([]);

  const [heatmap, setHeatmap] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);


  // ==========================================================
  // LOAD ALL LIVE DATA
  // ==========================================================

  const loadDashboard =
    useCallback(
      async ({
        silent = false,
      } = {}) => {

        try {

          if (!silent) {
            setLoading(true);
          }


          setError(null);


          const [
            eventsResponse,
            countsResponse,
            speedsResponse,
            alertsResponse,
            trajectoriesResponse,
            odResponse,
            heatmapResponse,
          ] = await Promise.all([

            // -----------------------------------------------
            // RAW ANPR EVENTS
            // -----------------------------------------------

            fetch(
              `${API_BASE}/events`
            ).then(
              async (
                response
              ) => {

                if (
                  !response.ok
                ) {
                  throw new Error(
                    "Events API failed"
                  );
                }

                return response.json();

              }
            ),


            getCounts(),

            getSpeeds(),

            getAlerts(),

            getTrajectories(),

            getOD(),

            getHeatmap(),
          ]);


          setEvents(
            asArray(
              eventsResponse
            )
          );


          setCounts(
            asArray(
              countsResponse.data
            )
          );


          setSpeeds(
            asArray(
              speedsResponse.data
            )
          );


          setAlerts(
            asArray(
              alertsResponse.data
            )
          );


          setTrajectories(
            asArray(
              trajectoriesResponse.data
            )
          );


          setOdFlows(
            asArray(
              odResponse.data
            )
          );


          setHeatmap(
            asArray(
              heatmapResponse.data
            )
          );


          setLastUpdated(
            new Date()
          );

        }

        catch (loadError) {

          console.error(
            "Dashboard load error:",
            loadError
          );


          setError(
            "Backend unavailable. Confirm FastAPI is running at http://127.0.0.1:8000"
          );

        }

        finally {

          if (!silent) {
            setLoading(false);
          }

        }

      },
      []
    );


  // ==========================================================
  // INITIAL LOAD + POLLING
  // ==========================================================

  useEffect(() => {

    loadDashboard();


    const intervalId =
      window.setInterval(
        () => {

          loadDashboard({
            silent: true,
          });

        },
        POLL_INTERVAL_MS
      );


    return () => {

      window.clearInterval(
        intervalId
      );

    };

  }, [
    loadDashboard,
  ]);


  // ==========================================================
  // METRICS
  // ==========================================================

  const metrics = useMemo(() => {

    // ========================================================
    // TRUE CITY-WIDE UNIQUE PLATES
    // ========================================================

    const uniquePlateSet =
      new Set();


    events.forEach(
      (event) => {

        const plate =
          normalizePlate(
            event.plate
          );


        if (plate) {

          uniquePlateSet.add(
            plate
          );

        }

      }
    );


    const uniqueVehicles =
      uniquePlateSet.size;


    // ========================================================
    // TOTAL RAW ANPR EVENTS
    // ========================================================

    const totalEvents =
      events.length;


    // ========================================================
    // NUMBER OF ACTIVE CAMERA NODES
    // ========================================================

    const activeCameras =
      new Set(
        events
          .map(
            (event) =>
              event.camera_id
          )
          .filter(Boolean)
      ).size
      ||
      counts.length
      ||
      heatmap.length;


    // ========================================================
    // COMPLETED MULTI-CAMERA VEHICLES
    // ========================================================

    const trajectoryVehicles =
      new Set(
        trajectories
          .map(
            (trajectory) =>
              normalizePlate(
                trajectory.plate
              )
          )
          .filter(Boolean)
      ).size;


    // ========================================================
    // SPEED
    // ========================================================
    //
    // IMPORTANT:
    //
    // This value only changes when the backend produces a new
    // valid camera-to-camera segment.
    //
    // A single-camera event cannot produce vehicle speed.
    // ========================================================

    const speedValues =
      speeds
        .map(
          (segment) =>
            Number(
              segment
                .average_speed_kmph
            )
        )
        .filter(
          (
            value
          ) =>
            Number.isFinite(
              value
            )
        );


    const averageSpeed =
      speedValues.length
        ? average(
            speedValues
          ).toFixed(1)
        : "0.0";


    return {

      // Main overview card
      totalVehicles:
        uniqueVehicles,

      uniqueVehicles,

      totalEvents,

      activeCameras,

      trajectoryVehicles,

      averageSpeed,

      activeAlerts:
        alerts.length,
    };

  }, [
    alerts,
    counts,
    events,
    heatmap,
    speeds,
    trajectories,
  ]);


  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value =
    useMemo(
      () => ({

        events,

        counts,

        speeds,

        alerts,

        trajectories,

        odFlows,

        heatmap,

        loading,

        error,

        metrics,

        lastUpdated,


        reload: () =>
          loadDashboard({
            silent: false,
          }),

      }),
      [
        alerts,
        counts,
        error,
        events,
        heatmap,
        lastUpdated,
        loadDashboard,
        loading,
        metrics,
        odFlows,
        speeds,
        trajectories,
      ]
    );


  return (

    <DashboardContext.Provider
      value={
        value
      }
    >

      {
        children
      }

    </DashboardContext.Provider>

  );
}


// ============================================================
// HOOK
// ============================================================

// eslint-disable-next-line react-refresh/only-export-components

export function useDashboard() {

  const context =
    useContext(
      DashboardContext
    );


  if (!context) {

    throw new Error(
      "useDashboard must be used within DashboardProvider"
    );

  }


  return context;
}