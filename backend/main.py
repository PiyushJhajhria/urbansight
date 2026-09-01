import json

from pathlib import Path
from collections import defaultdict
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from intelligence_engine import process_intelligence


# ============================================================
# Paths
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

EVENTS_FILE = DATA_DIR / "events.jsonl"
TRAJECTORIES_FILE = DATA_DIR / "trajectories.json"
ALERTS_FILE = DATA_DIR / "all_alerts.json"


# ============================================================
# FastAPI
# ============================================================

app = FastAPI(
    title="City ANPR Backend"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Camera configuration
# ============================================================

CAMERA_DISTANCES = {
    ("CAM_01", "CAM_02"): 4,
    ("CAM_02", "CAM_03"): 6,
    ("CAM_01", "CAM_03"): 9
}


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


# ============================================================
# Incoming event model
# ============================================================

class ANPREvent(BaseModel):

    plate: str

    track_id: int

    camera_id: str

    timestamp: str


# ============================================================
# Helpers
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

            return json.load(
                file
            )

    except (
        json.JSONDecodeError,
        OSError
    ):

        return default


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
                    json.loads(
                        line
                    )
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
# Home
# ============================================================

@app.get("/")
def home():

    return {
        "message":
            "ANPR Backend Running"
    }


# ============================================================
# GET EVENTS
# ============================================================

@app.get("/events")
def get_events():

    return load_events()


# ============================================================
# POST EVENT
# ============================================================

@app.post("/events")
def create_event(
    event: ANPREvent
):

    ensure_data_directory()


    # --------------------------------------------------------
    # Clean plate
    # --------------------------------------------------------

    plate = (
        event.plate
        .strip()
        .upper()
    )


    if not plate:

        raise HTTPException(
            status_code=400,
            detail=
                "Plate number cannot be empty"
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
            detail=
                "Unknown camera ID"
        )


    # --------------------------------------------------------
    # Validate timestamp before storing
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
    # Trigger intelligence engine
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


        # Event itself was still stored successfully.

        return {
            "message":
                "ANPR event stored, but intelligence processing failed",

            "event":
                new_event,

            "processing_error":
                str(error)
        }


    # --------------------------------------------------------
    # Success
    # --------------------------------------------------------

    return {

        "message":
            "ANPR event stored and processed successfully",

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
        plate_number.upper()
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
        plate_number.upper()
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
# CAMERA TRAFFIC COUNTS
# ============================================================

@app.get("/analytics/counts")
def get_camera_counts():

    camera_vehicles = (
        defaultdict(set)
    )


    for event in load_events():

        camera_vehicles[
            event["camera_id"]
        ].add(
            event["plate"]
        )


    result = []


    for (
        camera_id,
        plates
    ) in camera_vehicles.items():

        result.append({

            "camera_id":
                camera_id,

            "vehicle_count":
                len(plates)
        })


    return result


# ============================================================
# AVERAGE SEGMENT SPEEDS
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

        route = trajectory.get(
            "route",
            []
        )


        for i in range(
            len(route) - 1
        ):

            first = route[i]

            second = route[
                i + 1
            ]


            cam1 = (
                first[
                    "camera_id"
                ]
            )

            cam2 = (
                second[
                    "camera_id"
                ]
            )


            distance = get_distance(
                cam1,
                cam2
            )


            if distance is None:
                continue


            time1 = datetime.strptime(
                first["timestamp"],
                "%Y-%m-%d %H:%M:%S"
            )


            time2 = datetime.strptime(
                second["timestamp"],
                "%Y-%m-%d %H:%M:%S"
            )


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
# ORIGIN-DESTINATION ANALYSIS
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

        route = trajectory.get(
            "route",
            []
        )


        if len(route) < 2:
            continue


        origin = (
            route[0][
                "camera_id"
            ]
        )


        destination = (
            route[-1][
                "camera_id"
            ]
        )


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
# HEATMAP DATA
# ============================================================

@app.get("/analytics/heatmap")
def get_heatmap_data():

    camera_counts = (
        defaultdict(int)
    )


    for event in load_events():

        camera_counts[
            event[
                "camera_id"
            ]
        ] += 1


    result = []


    for (
        camera_id,
        location
    ) in CAMERA_LOCATIONS.items():

        result.append({

            "camera_id":
                camera_id,

            "lat":
                location["lat"],

            "lon":
                location["lon"],

            "vehicle_count":
                camera_counts[
                    camera_id
                ]
        })


    return result