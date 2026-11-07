// Loads the project's .env (one level above backend/) no matter which folder the server is
// started from, and lets it win over variables already set in the terminal (e.g. a stray
// NODE_ENV=production), so the mode and CORS always match the file.
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), override: true });
