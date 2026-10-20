/*
 * Environment and patient model choices on the scenario form. Only the `id` is
 * saved on the scenario (and served to the simulator via GET /api/scenarios/json),
 * so ids must stay stable; labels and images are display-only.
 */
const unsplash = (photo) =>
  `https://images.unsplash.com/photo-${photo}?w=400&h=260&fit=crop`;

export const ENVIRONMENTS = [
  { id: "hospital_ward", label: "Hospital Ward", image: unsplash("1512678080530-7760d81faba6") },
  { id: "clinic_room", label: "Clinic Room", image: unsplash("1631217868264-e5b90bb7e133") },
  { id: "reception", label: "Hospital Reception", image: unsplash("1519494026892-80bbd2d6fd0d") },
  { id: "home_rehab", label: "Home / Rehab", image: unsplash("1571019613454-1cb2f99b2d8b") },
];

export const MODELS = [
  { id: "male_1", label: "Male 1", gender: "Male", image: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: "male_2", label: "Male 2", gender: "Male", image: "https://randomuser.me/api/portraits/men/75.jpg" },
  { id: "female_1", label: "Female 1", gender: "Female", image: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: "female_2", label: "Female 2", gender: "Female", image: "https://randomuser.me/api/portraits/women/68.jpg" },
];
