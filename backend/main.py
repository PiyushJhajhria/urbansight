import json
import urllib.parse
import urllib.request


from pathlib import Path
from collections import defaultdict
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from intelligence_engine import process_intelligence


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

EVENTS_FILE = DATA_DIR / "events.jsonl"
TRAJECTORIES_FILE = DATA_DIR / "trajectories.json"
ALERTS_FILE = DATA_DIR / "all_alerts.json"

ROAD_ROUTES_FILE = DATA_DIR / "road_routes.json"


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="UrbanSight ANPR Backend",
    description=(
        "ANPR events, vehicle trajectories, traffic analytics, "
        "alerts and road-network reconstruction."
    ),
    version="2.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# CAMERA CONFIGURATION
# ============================================================

CAMERA_LOCATIONS = {

    "CAM_01": {
        "lat": 21.1702,
        "lon": 72.8311
    },

    "CAM_02": {
        "lat": 21.1850,
        "lon": 72.8200
    },

    "CAM_03": {
        "lat": 21.2000,
        "lon": 72.8100
    }
}


# Existing prototype distances.
#
# IMPORTANT:
# These distances are currently used by the trajectory /
# anomaly / speed logic.
#
# We are NOT silently replacing them with OSRM road distance,
# because that could change your existing prototype behaviour.

CAMERA_DISTANCES = {

    ("CAM_01", "CAM_02"): 4,

    ("CAM_02", "CAM_03"): 6,

    ("CAM_01", "CAM_03"): 9
}


# Camera pairs for which road geometry should be generated.

ROAD_CAMERA_PAIRS = [

    ("CAM_01", "CAM_02"),

    ("CAM_02", "CAM_03"),

    ("CAM_01", "CAM_03"),
]


# ============================================================
# OSRM CONFIGURATION
# ============================================================

OSRM_BASE_URL = (
    "https://router.project-osrm.org"
)

OSRM_TIMEOUT_SECONDS = 8


# ============================================================
# EVENT MODEL
# ============================================================

class ANPREvent(BaseModel):

    plate: str

    track_id: int

    camera_id: str

    timestamp: str


# ============================================================
# GENERAL HELPERS
# ============================================================

def ensure_data_directory():

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


def load_json_file(
    path,
    default
):

    if not path.exists():
        return default

    try:

        with open(
            path,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except (
        json.JSONDecodeError,
        OSError
    ):

        return default


def save_json_file(
    path,
    data
):

    ensure_data_directory()

    with open(
        path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            indent=2
        )


def load_events():

    events = []

    if not EVENTS_FILE.exists():
        return events

    with open(
        EVENTS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        for line in file:

            line = line.strip()

            if not line:
                continue

            try:

                events.append(
                    json.loads(line)
                )

            except json.JSONDecodeError:

                continue

    return events


def get_distance(
    cam1,
    cam2
):

    if (
        cam1,
        cam2
    ) in CAMERA_DISTANCES:

        return CAMERA_DISTANCES[
            (
                cam1,
                cam2
            )
        ]

    if (
        cam2,
        cam1
    ) in CAMERA_DISTANCES:

        return CAMERA_DISTANCES[
            (
                cam2,
                cam1
            )
        ]

    return None


# ============================================================
# ROAD NETWORK HELPERS
# ============================================================

def validate_camera_id(
    camera_id
):

    if (
        camera_id
        not in CAMERA_LOCATIONS
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown camera ID: "
                f"{camera_id}"
            )
        )


def create_direct_fallback_route(
    from_camera,
    to_camera
):

    start = CAMERA_LOCATIONS[
        from_camera
    ]

    end = CAMERA_LOCATIONS[
        to_camera
    ]

    return {

        "from_camera":
            from_camera,

        "to_camera":
            to_camera,

        "points": [

            {
                "lat":
                    start["lat"],

                "lon":
                    start["lon"]
            },

            {
                "lat":
                    end["lat"],

                "lon":
                    end["lon"]
            }
        ],

        "distance_km":
            get_distance(
                from_camera,
                to_camera
            ),

        "duration_minutes":
            None,

        "source":
            "fallback"
    }


def fetch_osrm_route(
    from_camera,
    to_camera
):

    """
    Ask OSRM for a road-following route between two cameras.

    IMPORTANT:
    This is a probable road-network path between confirmed
    ANPR sightings.

    It is NOT claimed to be the exact GPS path taken by
    the vehicle.
    """

    validate_camera_id(
        from_camera
    )

    validate_camera_id(
        to_camera
    )

    start = CAMERA_LOCATIONS[
        from_camera
    ]

    end = CAMERA_LOCATIONS[
        to_camera
    ]


    # OSRM coordinate order:
    #
    # longitude,latitude
    #
    # NOT latitude,longitude.

    coordinates = (

        f"{start['lon']},"
        f"{start['lat']};"

        f"{end['lon']},"
        f"{end['lat']}"
    )


    query = urllib.parse.urlencode({

        "overview":
            "full",

        "geometries":
            "geojson",

        "steps":
            "false"
    })


    url = (

        f"{OSRM_BASE_URL}"
        f"/route/v1/driving/"
        f"{coordinates}"
        f"?{query}"
    )


    request = urllib.request.Request(

        url,

        headers={

            "User-Agent":
                "UrbanSight-SIH-Prototype/1.0"
        }
    )


    try:

        with urllib.request.urlopen(
            request,
            timeout=OSRM_TIMEOUT_SECONDS
        ) as response:

            raw_response = (
                response
                .read()
                .decode("utf-8")
            )


        payload = json.loads(
            raw_response
        )


        if (
            payload.get("code")
            !=
            "Ok"
        ):

            print(
                "OSRM returned non-OK status:",
                payload.get("code")
            )

            return (
                create_direct_fallback_route(
                    from_camera,
                    to_camera
                )
            )


        routes = payload.get(
            "routes",
            []
        )


        if not routes:

            print(
                "OSRM returned no routes for",
                from_camera,
                to_camera
            )

            return (
                create_direct_fallback_route(
                    from_camera,
                    to_camera
                )
            )


        route = routes[0]


        geometry = (
            route
            .get(
                "geometry",
                {}
            )
            .get(
                "coordinates",
                []
            )
        )


        if (
            len(geometry)
            <
            2
        ):

            return (
                create_direct_fallback_route(
                    from_camera,
                    to_camera
                )
            )


        # GeoJSON coordinates are:
        #
        # [longitude, latitude]
        #
        # React Leaflet wants:
        #
        # latitude, longitude
        #
        # Therefore convert here.

        points = []

        for coordinate in geometry:

            if (
                not isinstance(
                    coordinate,
                    list
                )
                or
                len(coordinate)
                <
                2
            ):

                continue

            lon = coordinate[0]

            lat = coordinate[1]

            points.append({

                "lat":
                    lat,

                "lon":
                    lon
            })


        if len(points) < 2:

            return (
                create_direct_fallback_route(
                    from_camera,
                    to_camera
                )
            )


        distance_meters = (
            route.get(
                "distance",
                0
            )
        )


        duration_seconds = (
            route.get(
                "duration",
                0
            )
        )


        return {

            "from_camera":
                from_camera,

            "to_camera":
                to_camera,

            "points":
                points,

            "distance_km":
                round(
                    distance_meters
                    /
                    1000,
                    2
                ),

            "duration_minutes":
                round(
                    duration_seconds
                    /
                    60,
                    2
                ),

            "source":
                "osrm"
        }


    except Exception as error:

        print(
            "OSRM ERROR",
            from_camera,
            "->",
            to_camera,
            ":",
            error
        )

        return (
            create_direct_fallback_route(
                from_camera,
                to_camera
            )
        )


def find_cached_route(
    routes,
    from_camera,
    to_camera
):

    for route in routes:

        if (
            route.get(
                "from_camera"
            )
            ==
            from_camera
            and
            route.get(
                "to_camera"
            )
            ==
            to_camera
        ):

            return route


        if (
            route.get(
                "from_camera"
            )
            ==
            to_camera
            and
            route.get(
                "to_camera"
            )
            ==
            from_camera
        ):

            reversed_route = (
                dict(route)
            )


            reversed_route[
                "from_camera"
            ] = from_camera


            reversed_route[
                "to_camera"
            ] = to_camera


            reversed_route[
                "points"
            ] = list(
                reversed(
                    route.get(
                        "points",
                        []
                    )
                )
            )


            return reversed_route


    return None


def build_road_network(
    force_refresh=False
):

    """
    Load cached road geometry when possible.

    If no usable cache exists, obtain road geometry from OSRM.

    Successful routes are saved to:
        backend/data/road_routes.json
    """

    ensure_data_directory()


    cached_routes = (
        load_json_file(
            ROAD_ROUTES_FILE,
            []
        )
    )


    result = []


    for (
        from_camera,
        to_camera
    ) in ROAD_CAMERA_PAIRS:


        cached = (
            find_cached_route(
                cached_routes,
                from_camera,
                to_camera
            )
        )


        # ----------------------------------------------------
        # Use cached OSRM route
        # ----------------------------------------------------

        if (
            not force_refresh
            and
            cached
            and
            cached.get("source")
            ==
            "osrm"
            and
            len(
                cached.get(
                    "points",
                    []
                )
            )
            >=
            2
        ):

            result.append(
                cached
            )

            continue


        # ----------------------------------------------------
        # Fetch a fresh road route
        # ----------------------------------------------------

        route = (
            fetch_osrm_route(
                from_camera,
                to_camera
            )
        )


        result.append(
            route
        )


    # --------------------------------------------------------
    # Save whichever results we obtained.
    #
    # This also makes the last fetched state available
    # during demonstrations.
    # --------------------------------------------------------

    save_json_file(
        ROAD_ROUTES_FILE,
        result
    )


    return result


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {

        "message":
            "UrbanSight ANPR Backend Running",

        "status":
            "ok"
    }


# ============================================================
# EVENTS
# ============================================================

@app.get("/events")
def get_events():

    return load_events()


@app.post("/events")
def create_event(
    event: ANPREvent
):

    ensure_data_directory()


    # --------------------------------------------------------
    # Normalize plate
    # --------------------------------------------------------

    plate = (
        event.plate
        .strip()
        .upper()
    )


    if not plate:

        raise HTTPException(
            status_code=400,
            detail=(
                "Plate number cannot be empty"
            )
        )


    # --------------------------------------------------------
    # Validate camera
    # --------------------------------------------------------

    if (
        event.camera_id
        not in CAMERA_LOCATIONS
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Unknown camera ID"
            )
        )


    # --------------------------------------------------------
    # Validate timestamp
    # --------------------------------------------------------

    try:

        datetime.strptime(
            event.timestamp,
            "%Y-%m-%d %H:%M:%S"
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail=(
                "Timestamp must use format "
                "YYYY-MM-DD HH:MM:SS"
            )
        )


    # --------------------------------------------------------
    # Create normalized event
    # --------------------------------------------------------

    new_event = {

        "plate":
            plate,

        "track_id":
            event.track_id,

        "camera_id":
            event.camera_id,

        "timestamp":
            event.timestamp
    }


    # --------------------------------------------------------
    # Store event
    # --------------------------------------------------------

    with open(
        EVENTS_FILE,
        "a",
        encoding="utf-8"
    ) as file:

        file.write(
            json.dumps(
                new_event
            )
            +
            "\n"
        )


    # --------------------------------------------------------
    # Trigger trajectory / analytics / alerts
    # --------------------------------------------------------

    try:

        intelligence = (
            process_intelligence()
        )


    except Exception as error:

        print(
            "INTELLIGENCE ENGINE ERROR:",
            error
        )


        return {

            "message":
                (
                    "ANPR event stored, but "
                    "intelligence processing failed"
                ),

            "event":
                new_event,

            "processing_error":
                str(error)
        }


    return {

        "message":
            (
                "ANPR event stored and "
                "processed successfully"
            ),

        "event":
            new_event,

        "intelligence":
            intelligence
    }


# ============================================================
# TRAJECTORIES
# ============================================================

@app.get("/trajectories")
def get_trajectories():

    return load_json_file(
        TRAJECTORIES_FILE,
        []
    )


# ============================================================
# ALERTS
# ============================================================

@app.get("/alerts")
def get_alerts():

    return load_json_file(
        ALERTS_FILE,
        []
    )


# ============================================================
# PLATE SEARCH
# ============================================================

@app.get(
    "/plate/{plate_number}"
)
def search_plate(
    plate_number: str
):

    plate_number = (
        plate_number
        .strip()
        .upper()
    )


    matched_events = []


    for event in load_events():

        if (
            event.get(
                "plate",
                ""
            ).upper()
            ==
            plate_number
        ):

            matched_events.append(
                event
            )


    return {

        "plate":
            plate_number,

        "events":
            matched_events
    }


# ============================================================
# VEHICLE TRAJECTORY
# ============================================================

@app.get(
    "/trajectory/{plate_number}"
)
def get_vehicle_trajectory(
    plate_number: str
):

    plate_number = (
        plate_number
        .strip()
        .upper()
    )


    trajectories = (
        load_json_file(
            TRAJECTORIES_FILE,
            []
        )
    )


    for trajectory in trajectories:

        if (
            trajectory.get(
                "plate",
                ""
            ).upper()
            ==
            plate_number
        ):

            return trajectory


    return {

        "message":
            "Trajectory not found"
    }


# ============================================================
# CAMERA COUNTS
# ============================================================

@app.get("/analytics/counts")
def get_camera_counts():

    camera_vehicles = (
        defaultdict(set)
    )


    for event in load_events():

        camera_id = (
            event.get(
                "camera_id"
            )
        )

        plate = (
            event.get(
                "plate"
            )
        )


        if (
            not camera_id
            or
            not plate
        ):

            continue


        camera_vehicles[
            camera_id
        ].add(
            plate
        )


    result = []


    # Include every configured camera even if its count is 0.

    for camera_id in CAMERA_LOCATIONS:

        result.append({

            "camera_id":
                camera_id,

            "vehicle_count":
                len(
                    camera_vehicles[
                        camera_id
                    ]
                )
        })


    return result


# ============================================================
# AVERAGE SEGMENT SPEED
# ============================================================

@app.get("/analytics/speeds")
def get_average_speeds():

    trajectories = (
        load_json_file(
            TRAJECTORIES_FILE,
            []
        )
    )


    segment_speeds = (
        defaultdict(list)
    )


    for trajectory in trajectories:

        route = (
            trajectory.get(
                "route",
                []
            )
        )


        for i in range(
            len(route) - 1
        ):

            first = route[i]

            second = route[
                i + 1
            ]


            cam1 = first.get(
                "camera_id"
            )

            cam2 = second.get(
                "camera_id"
            )


            if (
                not cam1
                or
                not cam2
            ):

                continue


            distance = (
                get_distance(
                    cam1,
                    cam2
                )
            )


            if distance is None:

                continue


            try:

                time1 = (
                    datetime.strptime(
                        first[
                            "timestamp"
                        ],
                        "%Y-%m-%d %H:%M:%S"
                    )
                )


                time2 = (
                    datetime.strptime(
                        second[
                            "timestamp"
                        ],
                        "%Y-%m-%d %H:%M:%S"
                    )
                )


            except (
                KeyError,
                ValueError
            ):

                continue


            seconds = (
                time2
                -
                time1
            ).total_seconds()


            if seconds <= 0:

                continue


            speed = (

                distance
                /
                (
                    seconds
                    /
                    3600
                )
            )


            segment_speeds[
                (
                    cam1,
                    cam2
                )
            ].append(
                speed
            )


    result = []


    for (
        segment,
        speeds
    ) in segment_speeds.items():

        result.append({

            "from_camera":
                segment[0],

            "to_camera":
                segment[1],

            "average_speed_kmph":
                round(
                    sum(speeds)
                    /
                    len(speeds),
                    2
                )
        })


    return result


# ============================================================
# ORIGIN DESTINATION
# ============================================================

@app.get("/analytics/od")
def get_od_analysis():

    trajectories = (
        load_json_file(
            TRAJECTORIES_FILE,
            []
        )
    )


    od_counts = (
        defaultdict(int)
    )


    for trajectory in trajectories:

        route = (
            trajectory.get(
                "route",
                []
            )
        )


        if len(route) < 2:

            continue


        origin = (
            route[0].get(
                "camera_id"
            )
        )


        destination = (
            route[-1].get(
                "camera_id"
            )
        )


        if (
            not origin
            or
            not destination
        ):

            continue


        od_counts[
            (
                origin,
                destination
            )
        ] += 1


    result = []


    for (
        origin,
        destination
    ), count in od_counts.items():

        result.append({

            "origin":
                origin,

            "destination":
                destination,

            "vehicle_count":
                count
        })


    return result


# ============================================================
# HEATMAP / CAMERA DENSITY DATA
# ============================================================

@app.get("/analytics/heatmap")
def get_heatmap_data():

    # Use unique plates per camera rather than raw OCR/event count.
    #
    # Repeated OCR readings from the same vehicle therefore do
    # not artificially increase camera density.

    camera_vehicles = (
        defaultdict(set)
    )


    for event in load_events():

        camera_id = (
            event.get(
                "camera_id"
            )
        )


        plate = (
            event.get(
                "plate"
            )
        )


        if (
            not camera_id
            or
            not plate
        ):

            continue


        camera_vehicles[
            camera_id
        ].add(
            plate
        )


    result = []


    for (
        camera_id,
        location
    ) in CAMERA_LOCATIONS.items():

        result.append({

            "camera_id":
                camera_id,

            "lat":
                location[
                    "lat"
                ],

            "lon":
                location[
                    "lon"
                ],

            "vehicle_count":
                len(
                    camera_vehicles[
                        camera_id
                    ]
                )
        })


    return result


# ============================================================
# ROAD NETWORK
# ============================================================

@app.get("/roads/network")
def get_road_network(
    refresh: bool = False
):

    """
    Return road-following geometry connecting all configured
    ANPR camera pairs.

    Example:

        GET /roads/network

    Force a fresh OSRM request:

        GET /roads/network?refresh=true
    """

    return build_road_network(
        force_refresh=refresh
    )


# ============================================================
# SINGLE ROAD ROUTE
# ============================================================

@app.get("/roads/route")
def get_road_route(
    from_camera: str,
    to_camera: str,
    refresh: bool = False
):

    validate_camera_id(
        from_camera
    )

    validate_camera_id(
        to_camera
    )


    if (
        from_camera
        ==
        to_camera
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Source and destination cameras "
                "must be different."
            )
        )


    cached_routes = (
        load_json_file(
            ROAD_ROUTES_FILE,
            []
        )
    )


    if not refresh:

        cached = (
            find_cached_route(
                cached_routes,
                from_camera,
                to_camera
            )
        )


        if (
            cached
            and
            cached.get(
                "source"
            )
            ==
            "osrm"
        ):

            return cached


    return fetch_osrm_route(
        from_camera,
        to_camera
    )