# Sprint Update — Week of 2026-10-20

## Done this sprint

### Dynamic scenario loading: patient name, gender and language

The simulator now gets the patient's identity along with the scenario, so the avatar's look and voice match the case instead of being fixed.

- When a scenario is generated, the AI extracts the **patient name**, **gender** (`Male` / `Female`) and **language** (`English` / `Japanese`) and saves them on the scenario.

### Scenarios are generated in the language of the input

- The AI writes the whole scenario in the language the prompt is typed in: a Japanese prompt gives a Japanese scenario, an English prompt gives an English scenario. The app's UI language setting doesn't affect it.
- Everything is in that language: the scenario name, all sections of the scenario prompt, the patient behaviour instructions, the sample conversation and all 23 feedback questions.
- Only the movement values, difficulty and gender stay in English, because the code reads them directly.
- Editing with AI follows the same rule: the language of the edit request decides the language of the updated scenario.

### Environment and Model selection on the scenario form

- Educators can pick an **Environment** and a **Model** when creating or editing a scenario. Each is a row of 4 image cards, saved with the scenario.
- Placeholder options (images are stock photos for now):

  | Environments                     | Models                |
  | -------------------------------- | --------------------- |
  | `hospital_ward` — Hospital Ward  | `male_1` — Male 1     |
  | `clinic_room` — Clinic Room      | `male_2` — Male 2     |
  | `reception` — Hospital Reception | `female_1` — Female 1 |
  | `home_rehab` — Home / Rehab      | `female_2` — Female 2 |

- The labels are translated in the Japanese UI.
- The selected ids are already sent to the simulator as `environment` and `model` from `GET /api/scenarios/json`. The 3D side doesn't use them yet.

## In progress

- **3D side:** building more patient models and environments.

## Plan for next week

- **Load environment and model in the 3D simulator.** The simulator reads `environment` and `model` from `/api/scenarios/json` and loads the matching scene and character.
- **Agree on a fallback.** Decide the default scene and character for scenarios with no selection, which includes all scenarios created before this sprint.
