/*
 * Environment and patient model choices on the scenario form. Only the `id` is
 * saved on the scenario (and served to the simulator via GET /api/scenarios/json),
 * so ids must stay stable; labels and images are display-only.
 */
import hospitalWard from "../assets/scenario/env-hospital-ward.jpeg";
import clinicRoom from "../assets/scenario/env-clinic-room.jpeg";
import avatarMale from "../assets/scenario/avatar-male.jpeg";
import avatarFemale from "../assets/scenario/avatar-female.jpeg";

export const ENVIRONMENTS = [
  { id: "hospital_ward", label: "Hospital Ward", image: hospitalWard },
  { id: "clinic_room", label: "Clinic Room", image: clinicRoom },
];

export const MODELS = [
  { id: "male_1", label: "Male", gender: "Male", image: avatarMale },
  { id: "female_1", label: "Female", gender: "Female", image: avatarFemale },
];
