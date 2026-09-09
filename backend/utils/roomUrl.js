/**
 * The one place the simulator's URL is defined.
 *
 * It used to live in two: sessionRoutes.js built it for a student pressing Start,
 * and src/roles/educator/scenarios/ScenarioTable.jsx had its own build-time copy
 * for an educator pressing Test. Changing the StreamPixel build updated one and
 * left the other pointing at the old app, so educators and students were sent to
 * different simulators — and the frontend copy needed a rebuild to change at all.
 *
 * Now the backend owns it and hands it to the educator's Test button in the
 * POST /api/scenarios/json response, so both roles resolve the same base from the
 * same environment variable.
 */
import mongoose from "mongoose";

/*
 * ROOM_BASE_URL overrides the whole base without a redeploy — including the app
 * id, since a new StreamPixel build gets a new one.
 */
export const simulatorBaseUrl = () =>
  (
    process.env.ROOM_BASE_URL ||
    "https://share.streampixel.io/6aa15b2580d62d728d8bc5f8"
  ).replace(/\/+$/, "");

/**
 * The simulator URL for one run, isolated to its own room.
 *
 * Two people who press Start at the same time must not land in the same stream —
 * without a room they each saw the other's consultation, and the second arrival
 * displaced the first. The room is created implicitly by being visited, so
 * nothing has to be provisioned ahead of time; the id only has to be unique and
 * unguessable, which an ObjectId already is.
 *
 * Appended rather than assumed to be the first parameter, so a ROOM_BASE_URL that
 * already carries a query string is not silently broken by a second '?'.
 */
export const roomUrlFor = (roomId) => {
  const base = simulatorBaseUrl();
  return `${base}${base.includes("?") ? "&" : "?"}room=${encodeURIComponent(roomId)}`;
};

/*
 * An educator pressing Test has no session, so there is no session id to use as
 * the room. A throwaway one is minted instead — for the same reason as above: two
 * educators testing at once would otherwise share a stream.
 */
export const throwawayRoomUrl = () =>
  roomUrlFor(new mongoose.Types.ObjectId().toString());
