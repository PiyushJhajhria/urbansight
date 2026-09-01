import cv2
import re
import math
import requests

from ultralytics import YOLO
from paddleocr import PaddleOCR
from collections import defaultdict, Counter
from datetime import datetime
from difflib import SequenceMatcher


# ============================================================
# CONFIGURATION
# ============================================================

CAMERA_ID = "CAM_02"

VIDEO_PATH = "videos/Hey_Gemini_can_you_give_a_sim.mp4"

BACKEND_EVENT_URL = "http://127.0.0.1:8000/events"


OCR_FRAME_INTERVAL = 5

OCR_CONFIDENCE_THRESHOLD = 0.80


# ============================================================
# TRACKLET ASSOCIATION
# ============================================================

# At 30 FPS:
# 90 frames ≈ 3 seconds
TRACKLET_MAX_FRAME_GAP = 90

TRACKLET_MAX_CENTER_DISTANCE = 400

TRACKLET_OCR_SIMILARITY = 0.80


# ============================================================
# DELAYED FINALIZATION
# ============================================================

# Vehicle group must disappear for this many frames
# before we finalize it.
#
# Keep this equal to or slightly larger than
# TRACKLET_MAX_FRAME_GAP.
GROUP_INACTIVE_FRAMES = 90


# ============================================================
# CONSENSUS
# ============================================================

MIN_FINAL_READS = 3

# Exact majority is accepted only if it has strong support.
MIN_EXACT_SUPPORT = 3
MIN_EXACT_RATIO = 0.60

# Character voting fallback.
MIN_POSITION_SUPPORT = 0.50
MIN_AVERAGE_POSITION_SUPPORT = 0.75

MAX_READS_PER_VEHICLE = 30



# ============================================================
# LIVE / PROVISIONAL PLATE FOR VIDEO OVERLAY
# ============================================================

def get_live_plate(readings):
    """
    Returns the best current plate estimate for DISPLAY ONLY.

    This does NOT finalize the vehicle and does NOT send anything
    to FastAPI. Backend events still use the conservative delayed
    finalization logic in finalize_vehicle_group().
    """

    valid_readings = [
        reading
        for reading in readings
        if len(reading) == 10
    ]

    if not valid_readings:
        return ""

    # If the same exact plate has already appeared at least twice,
    # it is a strong provisional display candidate.
    exact_counts = Counter(valid_readings)
    best_exact_plate, best_exact_count = exact_counts.most_common(1)[0]

    if best_exact_count >= 2:
        return best_exact_plate

    # With 3+ observations, use simple position-wise voting so that
    # single-character OCR errors do not make the overlay jump around.
    if len(valid_readings) >= 3:
        voted_chars = []

        for position in range(10):
            char_counts = Counter(
                reading[position]
                for reading in valid_readings
            )
            voted_chars.append(
                char_counts.most_common(1)[0][0]
            )

        voted_plate = "".join(voted_chars)

        corrected, _, _ = prepare_plate_candidate(voted_plate)

        if corrected:
            return corrected

    # For the first one or two observations, show the latest valid
    # candidate as a provisional reading.
    return valid_readings[-1]


# ============================================================
# DUPLICATE SUPPRESSION
# ============================================================

DUPLICATE_WINDOW_SECONDS = 10


# ============================================================
# MODELS
# ============================================================

model = YOLO(
    "models/best.pt"
)


ocr = PaddleOCR(
    lang="en",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False
)


# ============================================================
# VIDEO
# ============================================================

cap = cv2.VideoCapture(
    VIDEO_PATH
)


if not cap.isOpened():

    print(
        f"ERROR: Could not open video: {VIDEO_PATH}"
    )

    exit()


# ============================================================
# STORAGE
# ============================================================

frame_count = 0

track_to_group = {}

vehicle_groups = {}

next_group_id = 1

recently_sent = {}


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_plate_text(text):

    text = str(
        text
    ).upper()

    return re.sub(
        r"[^A-Z0-9]",
        "",
        text
    )


# ============================================================
# OCR CHARACTER CORRECTIONS
# ============================================================

DIGIT_CORRECTIONS = {

    "O": "0",
    "Q": "0",
    "D": "0",

    "I": "1",
    "L": "1",

    "Z": "2",

    "S": "5",

    "G": "6",

    "B": "8"
}


LETTER_CORRECTIONS = {

    "0": "O",

    "1": "I",

    "2": "Z",

    "5": "S",

    "6": "G",

    "8": "B"
}


def make_letter(character):

    if character.isalpha():
        return character

    return LETTER_CORRECTIONS.get(
        character
    )


def make_digit(character):

    if character.isdigit():
        return character

    return DIGIT_CORRECTIONS.get(
        character
    )


# ============================================================
# PLATE TEMPLATE
# ============================================================

def apply_template(
    plate,
    template
):

    if len(plate) != len(template):

        return None


    result = []


    for (
        character,
        expected_type
    ) in zip(
        plate,
        template
    ):

        if expected_type == "L":

            corrected = make_letter(
                character
            )


        elif expected_type == "D":

            corrected = make_digit(
                character
            )


        else:

            return None


        if corrected is None:

            return None


        result.append(
            corrected
        )


    return "".join(
        result
    )


# ============================================================
# PREPARE PLATE
# ============================================================

def prepare_plate_candidate(
    raw_text
):

    normalized = normalize_plate_text(
        raw_text
    )


    if len(normalized) != 10:

        return (
            "",
            normalized,
            ""
        )


    templates = [

        (
            "STANDARD",
            "LLDDLLDDDD"
        ),

        (
            "DELHI_STYLE",
            "LLDLLLDDDD"
        )
    ]


    for (
        template_name,
        template
    ) in templates:

        corrected = apply_template(
            normalized,
            template
        )


        if corrected is not None:

            return (
                corrected,
                normalized,
                template_name
            )


    return (
        "",
        normalized,
        ""
    )


# ============================================================
# PLATE SIMILARITY
# ============================================================

def plate_similarity(
    plate1,
    plate2
):

    return SequenceMatcher(
        None,
        plate1,
        plate2
    ).ratio()


# ============================================================
# BOUNDING BOX HELPERS
# ============================================================

def bbox_center(
    bbox
):

    (
        x1,
        y1,
        x2,
        y2
    ) = bbox


    return (

        (x1 + x2) / 2,

        (y1 + y2) / 2
    )


def center_distance(
    bbox1,
    bbox2
):

    (
        x1,
        y1
    ) = bbox_center(
        bbox1
    )


    (
        x2,
        y2
    ) = bbox_center(
        bbox2
    )


    return math.sqrt(

        (x1 - x2) ** 2

        +

        (y1 - y2) ** 2
    )


# ============================================================
# CREATE VEHICLE GROUP
# ============================================================

def create_vehicle_group(
    track_id,
    bbox
):

    global next_group_id


    group_id = next_group_id

    next_group_id += 1


    vehicle_groups[
        group_id
    ] = {

        "track_ids": {
            track_id
        },

        "readings": [],

        "last_seen_frame":
            frame_count,

        "last_bbox":
            bbox,

        "sent":
            False,

        "finalized":
            False,

        "final_plate":
            ""
    }


    track_to_group[
        track_id
    ] = group_id


    print(
        f"\nNEW VEHICLE GROUP {group_id}"
        f" created for Track {track_id}"
    )


    return group_id


# ============================================================
# FIND MATCHING VEHICLE GROUP
# ============================================================

def find_matching_group(
    bbox,
    plate_candidate
):

    best_group_id = None

    best_score = 0


    for (
        group_id,
        group
    ) in vehicle_groups.items():

        # Already finalized groups should not
        # absorb new tracks.

        if group[
            "finalized"
        ]:

            continue


        frame_gap = (

            frame_count

            -

            group[
                "last_seen_frame"
            ]
        )


        if (
            frame_gap < 0
            or
            frame_gap
            >
            TRACKLET_MAX_FRAME_GAP
        ):

            continue


        distance = center_distance(

            bbox,

            group[
                "last_bbox"
            ]
        )


        if (
            distance
            >
            TRACKLET_MAX_CENTER_DISTANCE
        ):

            continue


        readings = group[
            "readings"
        ]


        if not readings:

            continue


        best_plate_score = 0


        for old_reading in readings[-8:]:

            score = plate_similarity(
                plate_candidate,
                old_reading
            )


            best_plate_score = max(
                best_plate_score,
                score
            )


        if (
            best_plate_score
            <
            TRACKLET_OCR_SIMILARITY
        ):

            continue


        if (
            best_plate_score
            >
            best_score
        ):

            best_score = (
                best_plate_score
            )

            best_group_id = (
                group_id
            )


    return (
        best_group_id,
        best_score
    )


# ============================================================
# ASSIGN TRACK TO VEHICLE GROUP
# ============================================================

def assign_track_to_group(
    track_id,
    bbox,
    plate_candidate
):

    if track_id in track_to_group:

        return (
            track_to_group[
                track_id
            ]
        )


    (
        matched_group_id,
        similarity_score
    ) = find_matching_group(
        bbox,
        plate_candidate
    )


    if matched_group_id is not None:

        track_to_group[
            track_id
        ] = matched_group_id


        vehicle_groups[
            matched_group_id
        ][
            "track_ids"
        ].add(
            track_id
        )


        print(
            f"\nTRACK FRAGMENT MERGED:"
            f" Track {track_id}"
            f" -> Vehicle Group {matched_group_id}"
            f" | similarity={similarity_score:.2f}"
        )


        return (
            matched_group_id
        )


    return create_vehicle_group(
        track_id,
        bbox
    )


# ============================================================
# UPDATE TRACK POSITION
# ============================================================

def update_group_location(
    track_id,
    bbox
):

    if track_id not in track_to_group:

        return


    group_id = track_to_group[
        track_id
    ]


    group = vehicle_groups[
        group_id
    ]


    if group[
        "finalized"
    ]:

        return


    group[
        "last_seen_frame"
    ] = frame_count


    group[
        "last_bbox"
    ] = bbox


# ============================================================
# CHARACTER LEVEL CONSENSUS
# ============================================================

def character_level_consensus(
    readings
):

    valid_readings = [

        reading

        for reading in readings

        if len(reading) == 10
    ]


    if (
        len(valid_readings)
        <
        MIN_FINAL_READS
    ):

        return (
            "",
            [],
            0.0
        )


    final_characters = []

    position_support = []


    for position in range(10):

        counts = Counter(

            reading[
                position
            ]

            for reading
            in valid_readings
        )


        (
            winning_character,
            winning_count
        ) = counts.most_common(
            1
        )[0]


        confidence = (

            winning_count

            /

            len(
                valid_readings
            )
        )


        final_characters.append(
            winning_character
        )


        position_support.append(
            confidence
        )


    final_plate = "".join(
        final_characters
    )


    average_support = (

        sum(
            position_support
        )

        /

        len(
            position_support
        )
    )


    minimum_support = min(
        position_support
    )


    if (
        minimum_support
        <
        MIN_POSITION_SUPPORT
    ):

        return (
            "",
            position_support,
            average_support
        )


    if (
        average_support
        <
        MIN_AVERAGE_POSITION_SUPPORT
    ):

        return (
            "",
            position_support,
            average_support
        )


    (
        corrected,
        _,
        _
    ) = prepare_plate_candidate(
        final_plate
    )


    if not corrected:

        return (
            "",
            position_support,
            average_support
        )


    return (
        corrected,
        position_support,
        average_support
    )


# ============================================================
# RECENCY-WEIGHTED CHARACTER CONSENSUS
# ============================================================

def recency_weighted_consensus(
    readings
):

    if (
        len(readings)
        <
        MIN_FINAL_READS
    ):

        return (
            "",
            0.0
        )


    valid_readings = [

        reading

        for reading in readings

        if len(reading) == 10
    ]


    if (
        len(valid_readings)
        <
        MIN_FINAL_READS
    ):

        return (
            "",
            0.0
        )


    final_characters = []

    position_confidences = []


    # Later OCR observations receive higher weight.
    #
    # Example:
    #
    # first reading weight = 1
    # second reading weight = 2
    # ...
    # latest reading has highest weight

    for position in range(10):

        weighted_counts = defaultdict(
            float
        )


        total_weight = 0


        for (
            index,
            reading
        ) in enumerate(
            valid_readings,
            start=1
        ):

            weight = index


            character = reading[
                position
            ]


            weighted_counts[
                character
            ] += weight


            total_weight += weight


        winning_character = max(

            weighted_counts,

            key=
                weighted_counts.get
        )


        winning_weight = (
            weighted_counts[
                winning_character
            ]
        )


        confidence = (

            winning_weight

            /

            total_weight
        )


        final_characters.append(
            winning_character
        )


        position_confidences.append(
            confidence
        )


    final_plate = "".join(
        final_characters
    )


    average_confidence = (

        sum(
            position_confidences
        )

        /

        len(
            position_confidences
        )
    )


    (
        corrected,
        _,
        _
    ) = prepare_plate_candidate(
        final_plate
    )


    if not corrected:

        return (
            "",
            average_confidence
        )


    return (
        corrected,
        average_confidence
    )


# ============================================================
# FINAL VEHICLE CONSENSUS
# ============================================================

def get_vehicle_consensus(
    readings
):

    if (
        len(readings)
        <
        MIN_FINAL_READS
    ):

        return (
            "",
            "",
            {}
        )


    # --------------------------------------------------------
    # Exact majority
    # --------------------------------------------------------

    exact_counts = Counter(
        readings
    )


    (
        best_exact_plate,
        exact_support
    ) = exact_counts.most_common(
        1
    )[0]


    exact_ratio = (

        exact_support

        /

        len(
            readings
        )
    )


    if (
        exact_support
        >=
        MIN_EXACT_SUPPORT
        and
        exact_ratio
        >=
        MIN_EXACT_RATIO
    ):

        return (

            best_exact_plate,

            "EXACT_MAJORITY",

            {
                "exact_support":
                    exact_support,

                "total_reads":
                    len(readings),

                "exact_ratio":
                    round(
                        exact_ratio,
                        2
                    )
            }
        )


    # --------------------------------------------------------
    # Recency-weighted voting
    # --------------------------------------------------------

    (
        weighted_plate,
        weighted_confidence
    ) = recency_weighted_consensus(
        readings
    )


    if weighted_plate:

        return (

            weighted_plate,

            "RECENCY_CHARACTER_VOTE",

            {
                "total_reads":
                    len(readings),

                "average_weighted_confidence":
                    round(
                        weighted_confidence,
                        2
                    )
            }
        )


    # --------------------------------------------------------
    # Normal character voting fallback
    # --------------------------------------------------------

    (
        character_plate,
        position_support,
        average_support
    ) = character_level_consensus(
        readings
    )


    if character_plate:

        return (

            character_plate,

            "CHARACTER_VOTE",

            {
                "total_reads":
                    len(readings),

                "average_position_support":
                    round(
                        average_support,
                        2
                    ),

                "minimum_position_support":
                    round(
                        min(
                            position_support
                        ),
                        2
                    )
            }
        )


    return (
        "",
        "",
        {}
    )


# ============================================================
# DUPLICATE SUPPRESSION
# ============================================================

def is_recent_duplicate(
    plate
):

    key = (
        CAMERA_ID,
        plate
    )


    now = datetime.now()


    if key not in recently_sent:

        return False


    elapsed = (

        now

        -

        recently_sent[
            key
        ]

    ).total_seconds()


    return (
        elapsed
        <=
        DUPLICATE_WINDOW_SECONDS
    )


def remember_sent_plate(
    plate
):

    recently_sent[
        (
            CAMERA_ID,
            plate
        )
    ] = datetime.now()


# ============================================================
# SEND EVENT
# ============================================================

def send_event_to_backend(
    event
):

    try:

        response = requests.post(
            BACKEND_EVENT_URL,
            json=event,
            timeout=5
        )


        if (
            response.status_code
            ==
            200
        ):

            print(
                "\n================================"
            )

            print(
                "EVENT SENT TO BACKEND"
            )

            print(
                "================================"
            )

            print(
                event
            )


            return True


        print(
            "\nBACKEND REJECTED EVENT"
        )


        print(
            "Status:",
            response.status_code
        )


        print(
            "Response:",
            response.text
        )


        return False


    except requests.exceptions.RequestException as error:

        print(
            "\nFAILED TO CONNECT TO BACKEND:"
        )


        print(
            error
        )


        return False


# ============================================================
# FINALIZE ONE VEHICLE GROUP
# ============================================================

def finalize_vehicle_group(
    group_id
):

    group = vehicle_groups[
        group_id
    ]


    if group[
        "finalized"
    ]:

        return


    group[
        "finalized"
    ] = True


    readings = group[
        "readings"
    ]


    print(
        "\n================================"
    )

    print(
        f"FINALIZING VEHICLE GROUP {group_id}"
    )

    print(
        "================================"
    )


    print(
        "Track IDs:",
        sorted(
            group[
                "track_ids"
            ]
        )
    )


    print(
        "Total readings:",
        len(
            readings
        )
    )


    (
        final_plate,
        consensus_method,
        consensus_details
    ) = get_vehicle_consensus(
        readings
    )


    if not final_plate:

        print(
            "No reliable final plate."
        )

        return


    group[
        "final_plate"
    ] = final_plate


    print(
        "Final plate:",
        final_plate
    )


    print(
        "Method:",
        consensus_method
    )


    print(
        "Details:",
        consensus_details
    )


    if is_recent_duplicate(
        final_plate
    ):

        print(
            "DUPLICATE SUPPRESSED:",
            final_plate
        )


        group[
            "sent"
        ] = True


        return


    event = {

        "plate":
            final_plate,

        "track_id":
            min(
                group[
                    "track_ids"
                ]
            ),

        "camera_id":
            CAMERA_ID,

        "timestamp":
            datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )
    }


    success = send_event_to_backend(
        event
    )


    if success:

        group[
            "sent"
        ] = True


        remember_sent_plate(
            final_plate
        )


# ============================================================
# FINALIZE INACTIVE GROUPS
# ============================================================

def finalize_inactive_groups():

    for (
        group_id,
        group
    ) in list(
        vehicle_groups.items()
    ):

        if group[
            "finalized"
        ]:

            continue


        inactive_frames = (

            frame_count

            -

            group[
                "last_seen_frame"
            ]
        )


        if (
            inactive_frames
            >=
            GROUP_INACTIVE_FRAMES
        ):

            finalize_vehicle_group(
                group_id
            )


# ============================================================
# MAIN LOOP
# ============================================================

while True:

    ret, frame = cap.read()


    if not ret:

        break


    frame_count += 1


    frame = cv2.resize(
        frame,
        (1280, 720)
    )


    results = model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        conf=0.5,
        verbose=False
    )


    boxes = results[
        0
    ].boxes


    if boxes.id is not None:

        for box in boxes:

            track_id = int(
                box.id[0]
            )


            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )


            height, width = (
                frame.shape[:2]
            )


            x1 = max(
                0,
                x1
            )

            y1 = max(
                0,
                y1
            )

            x2 = min(
                width,
                x2
            )

            y2 = min(
                height,
                y2
            )


            bbox = (
                x1,
                y1,
                x2,
                y2
            )


            update_group_location(
                track_id,
                bbox
            )


            plate_crop = frame[
                y1:y2,
                x1:x2
            ]


            if plate_crop.size == 0:

                continue


            # =================================================
            # OCR
            # =================================================

            if (
                frame_count
                %
                OCR_FRAME_INTERVAL
                ==
                0
            ):

                plate_crop_ocr = cv2.resize(
                    plate_crop,
                    None,
                    fx=4,
                    fy=4,
                    interpolation=
                        cv2.INTER_CUBIC
                )


                try:

                    ocr_result = ocr.predict(
                        plate_crop_ocr
                    )


                    texts = ocr_result[
                        0
                    ][
                        "rec_texts"
                    ]


                    scores = ocr_result[
                        0
                    ][
                        "rec_scores"
                    ]


                    combined_text = ""


                    for (
                        text,
                        score
                    ) in zip(
                        texts,
                        scores
                    ):

                        if (
                            score
                            <
                            OCR_CONFIDENCE_THRESHOLD
                        ):

                            continue


                        combined_text += (
                            normalize_plate_text(
                                text
                            )
                        )


                    (
                        valid_candidate,
                        normalized_text,
                        plate_format
                    ) = prepare_plate_candidate(
                        combined_text
                    )


                    if valid_candidate:

                        group_id = assign_track_to_group(
                            track_id,
                            bbox,
                            valid_candidate
                        )


                        group = vehicle_groups[
                            group_id
                        ]


                        group[
                            "last_seen_frame"
                        ] = frame_count


                        group[
                            "last_bbox"
                        ] = bbox


                        if (
                            len(
                                group[
                                    "readings"
                                ]
                            )
                            <
                            MAX_READS_PER_VEHICLE
                        ):

                            group[
                                "readings"
                            ].append(
                                valid_candidate
                            )


                        print(
                            f"\nTrack {track_id}"
                            f" -> Vehicle Group {group_id}"
                        )


                        print(
                            f"OCR: {normalized_text}"
                            f" -> {valid_candidate}"
                            f" [{plate_format}]"
                        )


                    elif normalized_text:

                        print(
                            f"\nTrack {track_id}"
                            f" rejected OCR:"
                            f" {normalized_text}"
                        )


                except Exception as error:

                    print(
                        "OCR ERROR:",
                        error
                    )


            # =================================================
            # DRAW
            # =================================================

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )


            label = (
                f"Track {track_id}"
            )


            if track_id in track_to_group:

                group_id = track_to_group[
                    track_id
                ]


                group = vehicle_groups[
                    group_id
                ]


                label += (
                    f" | V{group_id}"
                )


                # ---------------------------------------------
                # LIVE PLATE DISPLAY
                # ---------------------------------------------
                #
                # Show the best current OCR estimate while the
                # vehicle is still visible.
                #
                # IMPORTANT:
                # This is display-only. It does not trigger a
                # backend event. Final backend submission still
                # happens only after delayed finalization.

                display_plate = (
                    group["final_plate"]
                    if group["final_plate"]
                    else get_live_plate(
                        group["readings"]
                    )
                )


                if display_plate:

                    if group["final_plate"]:

                        label += (
                            f" | {display_plate}"
                        )

                    else:

                        label += (
                            f" | {display_plate} LIVE"
                        )


            cv2.putText(
                frame,
                label,
                (
                    x1,
                    max(
                        20,
                        y1 - 10
                    )
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2
            )


    # ========================================================
    # FINALIZE VEHICLES THAT HAVE LEFT
    # ========================================================

    finalize_inactive_groups()


    cv2.imshow(
        "Tracked ANPR",
        frame
    )


    if (
        cv2.waitKey(1)
        &
        0xFF
        ==
        ord("q")
    ):

        break


# ============================================================
# END-OF-VIDEO FINALIZATION
# ============================================================

print(
    "\nVIDEO FINISHED."
)


print(
    "Finalizing remaining vehicle groups..."
)


for group_id in list(
    vehicle_groups.keys()
):

    if not vehicle_groups[
        group_id
    ][
        "finalized"
    ]:

        finalize_vehicle_group(
            group_id
        )


# ============================================================
# CLEANUP
# ============================================================

cap.release()

cv2.destroyAllWindows()


# ============================================================
# SUMMARY
# ============================================================

print(
    "\n\n================================"
)

print(
    "FINAL VEHICLE GROUP SUMMARY"
)

print(
    "================================"
)


for (
    group_id,
    group
) in vehicle_groups.items():

    print(
        f"\nVehicle Group {group_id}"
    )


    print(
        "Track IDs:",
        sorted(
            group[
                "track_ids"
            ]
        )
    )


    print(
        "Readings:",
        group[
            "readings"
        ]
    )


    print(
        "Final plate:",
        group[
            "final_plate"
        ]
    )


    print(
        "Sent:",
        group[
            "sent"
        ]
    )


print(
    "\nANPR processing completed."
)