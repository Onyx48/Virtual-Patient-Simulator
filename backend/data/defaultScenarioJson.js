import { readFileSync } from "fs";

const { response } = JSON.parse(
  readFileSync(new URL("./defaultScenarioJson.json", import.meta.url), "utf8"),
);

export default response;
