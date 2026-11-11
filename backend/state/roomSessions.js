/*
 * Sessions opened in our Voxio room (room.html), by id: the scenario customs the room loads from
 * GET /api/scenarios/room/:sessionId, and who may load them. Filled by an educator's Test
 * (POST /api/scenarios/json) and, when STUDENT_ROOM_URL is set, by a student's Start
 * (POST /api/sessions/start). In memory: a restart means pressing Start or Test again.
 */
export const roomSessions = new Map();

/** Our room's URL for one session, on base (e.g. "/room.html"). */
export const roomPageUrl = (base, { sessionId, scenario }) => {
  const b = String(base).replace(/\/+$/, "");
  const q = new URLSearchParams({ session: sessionId, name: scenario?.scenarioName || "", patient: scenario?.patientName || "", ...(scenario?._id && { scenario: String(scenario._id) }) });
  return `${b}${b.includes("?") ? "&" : "?"}${q}`;
};
