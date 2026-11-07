import csv
from collections import Counter

OUT = "D:/vps/Virtual-Patient-Simulator/docs/avatar/avatar_movements.csv"
FL = [("full", "full"), ("ltd", "ltd")]
F90 = [("full", "full"), ("90", "90"), ("120", "120")]
F4 = [("full", "full"), ("ltd", "ltd"), ("90", "90"), ("120", "120")]

# region, key, sided, display name, what the patient does ({side} filled in), versions
M = [
    ("shoulder", "flexion", 1, "Shoulder flexion", "raises the {side} arm straight forward and up in front of the body, elbow straight, thumb pointing up, toward overhead beside the ear", F90),
    ("shoulder", "extension", 1, "Shoulder extension", "moves the {side} arm straight backward behind the body, elbow straight, palm facing the body", FL),
    ("shoulder", "abduction", 1, "Shoulder abduction", "lifts the {side} arm out to the side, elbow straight, palm turning up, toward overhead beside the ear", FL),
    ("shoulder", "external_rotation", 1, "Shoulder external rotation", "keeps the {side} elbow tucked against the side, bent to 90 degrees, and swings the forearm outward away from the belly", FL),
    ("shoulder", "internal_rotation", 1, "Shoulder internal rotation", "keeps the {side} elbow tucked against the side, bent to 90 degrees, and swings the forearm inward across the belly", FL),
    ("shoulder", "horizontal_adduction", 1, "Shoulder horizontal adduction", "lifts the {side} arm forward to shoulder height and sweeps it across the chest toward the opposite shoulder", FL),
    ("shoulder", "hand_behind_back", 1, "Hand behind back", "reaches the {side} hand behind the lower back and slides it up the spine as high as possible", FL),
    ("shoulder", "hand_behind_neck", 1, "Hand behind neck", "lifts the {side} hand and places it behind the head at the back of the neck, elbow pointing out to the side", FL),
    ("neck", "flexion", 0, "Neck flexion", "slowly bends the head forward, bringing the chin down toward the chest", FL),
    ("neck", "extension", 0, "Neck extension", "tilts the head back to look up at the ceiling", FL),
    ("neck", "left_rotation", 0, "Neck rotation to the left", "turns the head to look over the left shoulder, keeping the shoulders still", FL),
    ("neck", "right_rotation", 0, "Neck rotation to the right", "turns the head to look over the right shoulder, keeping the shoulders still", FL),
    ("neck", "protraction", 0, "Neck protraction", "slides the chin straight forward, poking the head forward without tilting it", FL),
    ("neck", "retraction", 0, "Neck retraction", "tucks the chin straight back, making a double chin, without tilting the head", FL),
    ("neck", "left_lateral_flexion", 0, "Neck side bend to the left", "tilts the head sideways, bringing the left ear toward the left shoulder, still facing forward", FL),
    ("neck", "right_lateral_flexion", 0, "Neck side bend to the right", "tilts the head sideways, bringing the right ear toward the right shoulder, still facing forward", FL),
    ("lower_back", "flexion", 0, "Lower back flexion", "stands and bends forward at the waist, reaching both hands down toward the toes, knees straight", FL),
    ("lower_back", "extension", 0, "Lower back extension", "stands, places both hands on the lower back and leans the upper body backward", FL),
    ("lower_back", "left_lateral_flexion", 0, "Lower back side bend to the left", "stands and slides the left hand down the outside of the left thigh, bending the trunk sideways to the left", FL),
    ("lower_back", "right_lateral_flexion", 0, "Lower back side bend to the right", "stands and slides the right hand down the outside of the right thigh, bending the trunk sideways to the right", FL),
    ("lower_back", "left_rotation", 0, "Trunk rotation to the left", "crosses the arms over the chest and twists the upper body to the left, hips facing forward", FL),
    ("lower_back", "right_rotation", 0, "Trunk rotation to the right", "crosses the arms over the chest and twists the upper body to the right, hips facing forward", FL),
    ("hip", "flexion", 1, "Hip flexion", "lifts the {side} knee up toward the chest, knee bent", F4),
    ("hip", "extension", 1, "Hip extension", "stands holding a chair and moves the straight {side} leg backward behind the body", FL),
    ("hip", "abduction", 1, "Hip abduction", "stands holding a chair and lifts the straight {side} leg out to the side, away from the other leg", FL),
    ("hip", "adduction", 1, "Hip adduction", "stands holding a chair and moves the straight {side} leg inward, across in front of the other leg", FL),
    ("hip", "internal_rotation", 1, "Hip internal rotation", "sits with the {side} knee bent at 90 degrees and swings the foot outward so the thigh rolls inward", FL),
    ("hip", "external_rotation", 1, "Hip external rotation", "sits with the {side} knee bent at 90 degrees and swings the foot inward so the thigh rolls outward", FL),
    ("knee", "flexion", 1, "Knee flexion", "bends the {side} knee, bringing the heel back toward the buttock", F4),
    ("knee", "extension", 1, "Knee extension", "sits and straightens the {side} knee, lifting the foot until the leg is straight out in front", FL),
    ("ankle", "dorsiflexion", 1, "Ankle dorsiflexion", "pulls the {side} foot and toes up toward the shin", FL),
    ("ankle", "plantarflexion", 1, "Ankle plantarflexion", "points the {side} foot and toes down, away from the shin", FL),
    ("ankle", "inversion", 1, "Ankle inversion", "turns the sole of the {side} foot inward to face the other foot", FL),
    ("ankle", "eversion", 1, "Ankle eversion", "turns the sole of the {side} foot outward, away from the other foot", FL),
    ("foot", "great_toe_extension", 1, "Big toe extension", "lifts the big toe of the {side} foot up, keeping the other toes down", FL),
    ("foot", "great_toe_flexion", 1, "Big toe flexion", "curls the big toe of the {side} foot down", FL),
    ("foot", "forefoot_pronation", 1, "Forefoot pronation", "rolls the front of the {side} foot so the big-toe side goes down and the little-toe side lifts", FL),
    ("foot", "forefoot_supination", 1, "Forefoot supination", "rolls the front of the {side} foot so the little-toe side goes down and the big-toe side lifts", FL),
    ("elbow", "flexion", 1, "Elbow flexion", "bends the {side} elbow, bringing the hand up toward the shoulder, upper arm still", FL),
    ("elbow", "extension", 1, "Elbow extension", "straightens the {side} elbow fully, arm hanging straight by the side", FL),
    ("forearm", "pronation", 1, "Forearm pronation", "bends the {side} elbow to 90 degrees against the side and turns the palm to face down", FL),
    ("forearm", "supination", 1, "Forearm supination", "bends the {side} elbow to 90 degrees against the side and turns the palm to face up", FL),
    ("wrist", "flexion", 1, "Wrist flexion", "holds the {side} forearm out in front, palm down, and bends the wrist so the hand points down", FL),
    ("wrist", "extension", 1, "Wrist extension", "holds the {side} forearm out in front, palm down, and bends the wrist back so the hand points up", FL),
    ("wrist", "radial_deviation", 1, "Wrist radial deviation", "holds the {side} forearm out in front, palm down, and tilts the hand sideways toward the thumb side", FL),
    ("wrist", "ulnar_deviation", 1, "Wrist ulnar deviation", "holds the {side} forearm out in front, palm down, and tilts the hand sideways toward the little-finger side", FL),
    ("thumb", "flexion", 1, "Thumb flexion", "holds the {side} hand up, palm facing the camera, and bends the thumb across the palm toward the little finger", FL),
    ("thumb", "extension", 1, "Thumb extension", "holds the {side} hand up, palm facing the camera, and moves the thumb straight out sideways away from the fingers", FL),
    ("thumb", "abduction", 1, "Thumb abduction", "holds the {side} hand up, palm facing the camera, and lifts the thumb forward, away from the palm, toward the camera", FL),
    ("thumb", "adduction", 1, "Thumb adduction", "holds the {side} hand up, palm facing the camera, thumb held out, and brings the thumb back in against the side of the index finger", FL),
    ("thumb", "opposition", 1, "Thumb opposition", "holds the {side} hand up, palm facing the camera, and touches the thumb tip to each fingertip in turn, index to little finger", FL),
    ("fingers", "fist", 1, "Make a fist", "holds the {side} hand up, palm facing the camera, and closes all the fingers into a tight fist", FL),
    ("fingers", "spread", 1, "Straighten and spread fingers", "holds the {side} hand up, palm facing the camera, and straightens all the fingers fully and spreads them apart", FL),
]

TESTS = [
    ("phalens", "Phalen's test", "presses the backs of both hands together in front of the chest, fingers pointing down, so both wrists are fully bent, and holds the position", "tingling and numbness in the {side} thumb and fingers"),
    ("reverse_phalens", "Reverse Phalen's test", "presses both palms together in front of the chest in a prayer position, fingers pointing up, elbows lifted, so both wrists are bent back, and holds", "tingling and numbness in the {side} thumb and fingers"),
    ("finkelstein", "Finkelstein test", "tucks the {side} thumb into the palm, closes the fingers over it to make a fist, then bends the wrist down toward the little-finger side", "sharp pain at the base of the {side} thumb"),
    ("grip", "Grip strength", "squeezes a hand-grip dynamometer hard in the {side} hand, arm by the side, elbow bent at 90 degrees", "pain in the {side} forearm or wrist"),
    ("pinch", "Pinch strength", "pinches a small pinch gauge firmly between the {side} thumb and index finger", "pain at the base of the {side} thumb"),
    ("cozens", "Resisted wrist extension (Cozen's)", "makes a fist with the {side} hand, forearm out in front palm down, and pushes the wrist up against resistance", "sharp pain at the outer {side} elbow"),
]

PERSON = ("The patient is a Taiwanese man of Han Chinese ethnicity, about 52 years old, 172 cm tall, average build with a slight belly. "
          "He has a warm light-tan East Asian skin tone, a rounded face, short neat black hair greying at the temples, parted on the side, "
          "dark brown eyes, thin rectangular black-framed glasses, clean-shaven, and a calm, slightly tired expression. "
          "He wears a plain light-blue short-sleeved cotton polo shirt, untucked, dark grey loose-fitting trousers, "
          "and dark grey socks with no shoes, so the arms, hands, wrists and feet are clearly visible. No watch, rings or jewellery. "
          "He is in a bright, clean physiotherapy clinic room in Taipei: plain off-white wall behind him, a light wooden floor, "
          "a treatment bed edge just visible on one side, soft even daylight from the front, no harsh shadows. "
          "Photorealistic, natural skin texture, real person, not a cartoon or 3D render. "
          "Full body visible from head to feet, camera at chest height, straight on, 16:9. ")
START = ""
REFERENCE = PERSON + ("He stands upright and relaxed in the middle of the frame, facing the camera, feet hip-width apart, "
                      "arms hanging naturally by his sides, palms facing his thighs, fingers relaxed and visible, "
                      "mouth closed, looking straight into the camera with a neutral, slightly uncomfortable expression.")
END = (" Then slowly returns to the exact starting pose. The last frame must match the first frame exactly. "
       "Mouth closed and relaxed, no speaking. About 10 seconds long (at least 10 seconds), 25 fps, with the movement paced slowly to fill the time.")

VERSION_NAME = {"full": "Full", "ltd": "Limited", "90": "Limited at 90 degrees", "120": "Limited at 120 degrees"}


def body(kind, action):
    if kind == "full":
        return f"The patient smoothly {action}, through the full normal range, comfortably, face relaxed. Holds the end position for two seconds."
    if kind == "ltd":
        return f"The patient slowly and stiffly {action}, but stops at about half of the normal range with a small wince of pain and cannot go further. Holds for two seconds."
    if kind == "90":
        return f"The patient slowly {action}, but stops at about 90 degrees (arm level with the shoulder) with a wince of pain and cannot go higher. Holds for two seconds."
    return f"The patient slowly {action}, but stops at about 120 degrees, a little above shoulder level, with a wince of pain and cannot go higher. Holds for two seconds."


rows = [dict(
    label="main", name="Resting pose", region="rest", movement="rest", side="", version="Rest",
    prompt=START + "The patient stands still at rest, facing the camera, breathing naturally, with small natural blinks and a slight body sway, arms hanging relaxed by the sides. The last frame must match the first frame exactly so it loops seamlessly. Mouth closed and relaxed, no speaking. About 10 seconds long (at least 10 seconds), 25 fps, with the movement paced slowly to fill the time.",
)]

for region, key, sided, name, action, versions in M:
    for side in (["left", "right"] if sided else [""]):
        for suffix, kind in versions:
            label = "_".join(x for x in [region, key, side, suffix] if x)
            rows.append(dict(
                label=label, name=name + (f" ({side})" if side else ""), region=region, movement=key,
                side=side, version=VERSION_NAME[kind],
                prompt=START + body(kind, action.format(side=side)) + END,
            ))

for key, name, action, pain in TESTS:
    for side in ["left", "right"]:
        for kind in ["no_pain", "painful"]:
            a = action.format(side=side)
            if kind == "no_pain":
                text = f"The patient {a}. Face relaxed, no pain. Holds for two seconds."
            else:
                text = f"The patient {a}. After a moment shows clear discomfort, wincing from {pain.format(side=side)}. Holds for two seconds."
            rows.append(dict(
                label=f"test_{key}_{side}_{kind}", name=f"{name} ({side})", region="test", movement=key,
                side=side, version="No pain" if kind == "no_pain" else "Painful",
                prompt=START + text + END,
            ))

with open(OUT, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=["label", "name", "region", "movement", "side", "version", "prompt"])
    w.writeheader()
    w.writerows(rows)

print(len(rows))
print(dict(Counter(r["region"] for r in rows)))
