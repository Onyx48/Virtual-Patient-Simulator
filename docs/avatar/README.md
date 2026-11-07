# Avatar movement clips

`avatar_movements.csv` lists every clip one avatar needs: **219 clips**. There is one row per clip, with a Google Flow description ready to paste.

| Column | What it is |
|---|---|
| `label` | The clip's name in Voxio. The patient AI returns this name when the student asks for the movement. Use it exactly, as the file name and as the label when uploading. |
| `name`, `region`, `movement`, `side`, `version` | What the clip shows. `version` is Full, Limited, Limited at 90/120 degrees, or for tests, Painful / No pain. |
| `prompt` | The description for Google Flow. |

## Folders

There is one folder per body part, numbered in working order. Limbs are split into `left/` and `right/`. Neck and lower back aren't split, because each movement already covers both directions. Each folder has `prompts.md` (headings and prompts to copy) and `prompts.csv`. Save the finished videos in the same folder.

```
01_rest/                1
02_shoulder/left|right  17 each
03_neck/                16
04_lower_back/          12
05_hip/left|right       14 each
06_knee/left|right       6 each
07_ankle/left|right      8 each
08_foot/left|right       8 each
09_elbow/left|right      4 each
10_forearm/left|right    4 each
11_wrist/left|right      8 each
12_thumb/left|right     10 each
13_fingers/left|right    4 each
14_test/left|right      12 each
```

## How to make each clip

1. Make **one reference image** of the person, at rest.
2. For every row, generate a video in Google Flow from that image, with the row's `prompt`. Set the reference image as **both the first and the last frame**.
3. Every clip starts and ends on the same frame. Each movement then starts and ends cleanly from rest, so no transition clips are needed.
4. Export at **25 fps**. Voxio plays exactly 25 frames a second, so a 30 fps clip plays slow.
5. Name the file after its `label`, e.g. `shoulder_flexion_right_90.mp4`.

The resting clip **must** be labelled `main`. Voxio returns to `main` between movements; without it, the patient can rest mid-movement.

## Counts per avatar

| Region | Clips |
|---|---|
| Resting pose | 1 |
| Shoulder | 34 |
| Neck | 16 |
| Lower back | 12 |
| Hip | 28 |
| Knee | 12 |
| Ankle | 16 |
| Foot | 16 |
| Elbow | 8 |
| Forearm | 8 |
| Wrist | 16 |
| Thumb | 20 |
| Fingers | 8 |
| OT tests (Phalen's, reverse Phalen's, Finkelstein, grip, pinch, Cozen's) | 24 |
| **Total** | **219** |

Each avatar in each environment needs its own set.

## Things to decide before generating

- **Seated or standing:** the lower back clips and most hip clips need the person standing. Every clip in a set must start and end on the same image, so either use a **standing** reference image for the whole set, or make a second set from a standing image. Standing works for everything except the hip rotations, which are written as seated.
- **Framing:** hand, thumb and wrist clips need the hands clearly visible. A full-body shot at normal distance may show fingers too small. A slightly closer framing that still shows the whole body is the best compromise.
- **Which to do first:** you don't need all 219 at once. A scenario only uses its affected area. Start with the shoulder (34) and the hand and wrist set (wrist, thumb, fingers and tests: 68).
