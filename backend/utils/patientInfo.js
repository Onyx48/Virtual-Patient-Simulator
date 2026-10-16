/**
 * The patient identity the simulator needs (name, gender, language), read out of
 * an AI response. Shared by the AI create/edit routes and
 * scripts/backfillPatientInfo.mjs, so both normalise gender the same way — the
 * model is told "Male"/"Female" but does not always obey the casing.
 */
export const patientInfoFrom = (generated = {}) => {
  const gender = String(generated.patient_gender || "").trim().toLowerCase();
  return {
    patient_name: String(generated.patient_name || "").trim(),
    patient_gender: gender === "male" ? "Male" : gender === "female" ? "Female" : "",
    language: String(generated.language || "").trim(),
  };
};
