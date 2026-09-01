import json
import re

from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime


# ============================================================
# FILE PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

EVENT_FILE = DATA_DIR / "events.jsonl"
BLACKLIST_FILE = DATA_DIR / "blacklist.json"

TRAJECTORY_FILE = DATA_DIR / "trajectories.json"

TRAJECTORY_ANOMALY_FILE = (
    DATA_DIR / "trajectory_anomalies.json"
)

BLACKLIST_ALERT_FILE = (
    DATA_DIR / "alerts.json"
)

ALL_ALERTS_FILE = (
    DATA_DIR / "all_alerts.json"
)


# ============================================================
# CONFIGURATION
# ============================================================

SIMILARITY_THRESHOLD = 0.85

MAX_SPEED_KMPH = 100


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


RESTRICTED_ROUTES = [

    ("CAM_03", "CAM_01")
]


# ============================================================
# HELPERS
# ============================================================

def normalize_plate(
    plate
):

    plate = str(
        plate
    ).upper()


    return re.sub(
        r"[^A-Z0-9]",
        "",
        plate
    )


def plate_similarity(
    plate1,
    plate2
):

    return SequenceMatcher(
        None,
        plate1,
        plate2
    ).ratio()


def get_distance(
    camera1,
    camera2
):

    if camera1 == camera2:

        return 0


    pair1 = (
        camera1,
        camera2
    )


    pair2 = (
        camera2,
        camera1
    )


    if pair1 in CAMERA_DISTANCES:

        return CAMERA_DISTANCES[
            pair1
        ]


    if pair2 in CAMERA_DISTANCES:

        return CAMERA_DISTANCES[
            pair2
        ]


    return None


def calculate_required_speed(
    event1,
    event2
):

    distance = get_distance(
        event1["camera_id"],
        event2["camera_id"]
    )


    if distance is None:

        return None


    time_difference = (

        event2["datetime"]

        -

        event1["datetime"]

    ).total_seconds()


    if time_difference <= 0:

        return None


    hours = (
        time_difference
        /
        3600
    )


    return (
        distance
        /
        hours
    )


def is_time_feasible(
    event1,
    event2
):

    speed = (
        calculate_required_speed(
            event1,
            event2
        )
    )


    if speed is None:

        return False


    return (
        speed
        <=
        MAX_SPEED_KMPH
    )


# ============================================================
# FILE HELPERS
# ============================================================

def ensure_data_files():

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


    if not EVENT_FILE.exists():

        EVENT_FILE.touch()


    if not BLACKLIST_FILE.exists():

        with open(
            BLACKLIST_FILE,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                [],
                file,
                indent=4
            )


def write_json(
    path,
    data
):

    with open(
        path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            indent=4
        )


# ============================================================
# LOAD EVENTS
# ============================================================

def load_events():

    ensure_data_files()


    events = []


    with open(
        EVENT_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        for line in file:

            line = (
                line.strip()
            )


            if not line:

                continue


            try:

                event = (
                    json.loads(
                        line
                    )
                )


                event["plate"] = (
                    normalize_plate(
                        event["plate"]
                    )
                )


                event["datetime"] = (
                    datetime.strptime(
                        event["timestamp"],
                        "%Y-%m-%d %H:%M:%S"
                    )
                )


                events.append(
                    event
                )


            except (
                json.JSONDecodeError,
                KeyError,
                ValueError,
                TypeError
            ) as error:

                print(
                    "Skipping invalid event:",
                    error
                )


    events.sort(
        key=lambda event:
        event["datetime"]
    )


    return events


# ============================================================
# BUILD TRAJECTORIES
# ============================================================

def build_trajectories(
    events
):

    trajectories = []

    trajectory_anomalies = []


    for event in events:

        matched = False


        for trajectory in trajectories:

            last_event = (
                trajectory[
                    "events"
                ][-1]
            )


            score = (
                plate_similarity(
                    event["plate"],
                    last_event["plate"]
                )
            )


            if (
                score
                <
                SIMILARITY_THRESHOLD
            ):

                continue


            # =================================================
            # FEASIBLE MOVEMENT
            # =================================================

            if (
                is_time_feasible(
                    last_event,
                    event
                )
            ):

                route_pair = (

                    last_event[
                        "camera_id"
                    ],

                    event[
                        "camera_id"
                    ]
                )


                if (
                    route_pair
                    in
                    RESTRICTED_ROUTES
                ):

                    trajectory_anomalies.append({

                        "type":
                            "RESTRICTED_ROUTE",

                        "plate":
                            event["plate"],

                        "from_camera":
                            last_event[
                                "camera_id"
                            ],

                        "to_camera":
                            event[
                                "camera_id"
                            ],

                        "timestamp":
                            event[
                                "timestamp"
                            ]
                    })


                trajectory[
                    "events"
                ].append(
                    event
                )


                matched = True

                break


            # =================================================
            # IMPOSSIBLE SPEED
            # =================================================

            else:

                required_speed = (
                    calculate_required_speed(
                        last_event,
                        event
                    )
                )


                if (
                    required_speed
                    is not None
                ):

                    trajectory_anomalies.append({

                        "type":
                            "IMPOSSIBLE_SPEED",

                        "plate_candidate":
                            event[
                                "plate"
                            ],

                        "matched_with":
                            last_event[
                                "plate"
                            ],

                        "similarity":
                            round(
                                score,
                                2
                            ),

                        "from_camera":
                            last_event[
                                "camera_id"
                            ],

                        "to_camera":
                            event[
                                "camera_id"
                            ],

                        "required_speed_kmph":
                            round(
                                required_speed,
                                2
                            ),

                        "from_timestamp":
                            last_event[
                                "timestamp"
                            ],

                        "to_timestamp":
                            event[
                                "timestamp"
                            ]
                    })


        # =====================================================
        # CREATE NEW TRAJECTORY
        # =====================================================

        if not matched:

            trajectories.append({

                "plate":
                    event[
                        "plate"
                    ],

                "events": [
                    event
                ]
            })


    return (
        trajectories,
        trajectory_anomalies
    )


# ============================================================
# REMOVE CONSECUTIVE DUPLICATE CAMERAS
# ============================================================

def remove_duplicate_camera_visits(
    events
):

    """
    Keep all raw events internally.

    Only simplify the displayed route:

        CAM_01
        CAM_01
        CAM_02
        CAM_02
        CAM_03

    becomes:

        CAM_01
        CAM_02
        CAM_03
    """


    if not events:

        return []


    cleaned_events = [

        events[0]
    ]


    for event in events[1:]:

        previous_event = (
            cleaned_events[-1]
        )


        if (
            event["camera_id"]
            ==
            previous_event["camera_id"]
        ):

            # Same camera again.
            #
            # Keep the earlier observation
            # for the route entry and skip
            # the duplicate camera visit.

            continue


        cleaned_events.append(
            event
        )


    return cleaned_events


# ============================================================
# CREATE FRONTEND TRAJECTORY OUTPUT
# ============================================================

def create_trajectory_output(
    trajectories
):

    trajectory_output = []


    for trajectory in trajectories:

        # ----------------------------------------------------
        # Clean repeated consecutive camera observations
        # ----------------------------------------------------

        cleaned_events = (
            remove_duplicate_camera_visits(
                trajectory[
                    "events"
                ]
            )
        )


        cameras = {

            event["camera_id"]

            for event
            in cleaned_events
        }


        # Only multi-camera routes are useful
        # as cross-camera trajectories.

        if len(cameras) < 2:

            continue


        route = []


        for event in cleaned_events:

            camera = (
                event[
                    "camera_id"
                ]
            )


            location = (
                CAMERA_LOCATIONS.get(
                    camera
                )
            )


            if location is None:

                continue


            route.append({

                "camera_id":
                    camera,

                "timestamp":
                    event[
                        "timestamp"
                    ],

                "plate_read":
                    event[
                        "plate"
                    ],

                "lat":
                    location[
                        "lat"
                    ],

                "lon":
                    location[
                        "lon"
                    ]
            })


        if len(route) >= 2:

            trajectory_output.append({

                "plate":
                    trajectory[
                        "plate"
                    ],

                "route":
                    route
            })


    return trajectory_output


# ============================================================
# BLACKLIST
# ============================================================

def load_blacklist():

    ensure_data_files()


    try:

        with open(
            BLACKLIST_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = (
                json.load(
                    file
                )
            )


    except (
        FileNotFoundError,
        json.JSONDecodeError
    ):

        return set()


    return {

        normalize_plate(
            plate
        )

        for plate
        in data
    }


# ============================================================
# BLACKLIST ALERTS
# ============================================================

def generate_blacklist_alerts(
    events
):

    blacklist = (
        load_blacklist()
    )


    alerts = []


    for event in events:

        plate = (
            normalize_plate(
                event[
                    "plate"
                ]
            )
        )


        if plate in blacklist:

            alerts.append({

                "type":
                    "BLACKLIST_MATCH",

                "plate":
                    plate,

                "camera_id":
                    event[
                        "camera_id"
                    ],

                "timestamp":
                    event[
                        "timestamp"
                    ],

                "alert_generated_at":
                    datetime.now().strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )
            })


    return alerts


# ============================================================
# COMPLETE INTELLIGENCE PIPELINE
# ============================================================

def process_intelligence():

    events = (
        load_events()
    )


    (
        trajectories,
        trajectory_anomalies
    ) = (
        build_trajectories(
            events
        )
    )


    trajectory_output = (
        create_trajectory_output(
            trajectories
        )
    )


    blacklist_alerts = (
        generate_blacklist_alerts(
            events
        )
    )


    all_alerts = (

        blacklist_alerts

        +

        trajectory_anomalies
    )


    write_json(
        TRAJECTORY_FILE,
        trajectory_output
    )


    write_json(
        TRAJECTORY_ANOMALY_FILE,
        trajectory_anomalies
    )


    write_json(
        BLACKLIST_ALERT_FILE,
        blacklist_alerts
    )


    write_json(
        ALL_ALERTS_FILE,
        all_alerts
    )


    return {

        "total_events":
            len(events),

        "multi_camera_trajectories":
            len(
                trajectory_output
            ),

        "blacklist_alerts":
            len(
                blacklist_alerts
            ),

        "trajectory_anomalies":
            len(
                trajectory_anomalies
            ),

        "total_alerts":
            len(
                all_alerts
            )
    }


# ============================================================
# MANUAL TEST
# ============================================================

if __name__ == "__main__":

    result = (
        process_intelligence()
    )


    print(
        "\nIntelligence processing complete"
    )


    print(
        json.dumps(
            result,
            indent=4
        )
    )