import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

/*
 * Optional DNS override, e.g. DNS_SERVERS=8.8.8.8,1.1.1.1.
 *
 * A mongodb+srv:// URI needs an SRV lookup, and on some Windows machines Node's
 * resolver is refused by the local DNS (querySrv ECONNREFUSED) even though
 * nslookup works. Unset — as on the server — Node keeps the system resolver.
 */
if (process.env.DNS_SERVERS) {
  const servers = process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean);
  dns.setServers(servers);
  console.log(`DNS servers overridden: ${servers.join(", ")}`);
}

const connectDB = async () => {
  try {
    // DEBUGGING: Remove these lines after fixing
    // console.log("Current Directory:", process.cwd());
    // console.log("Environment Variables Loaded:", process.env.MONGODB_URI ? "YES" : "NO");

    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is not defined. Check .env placement or spelling.",
      );
    }

    // MONGODB_DB (optional) picks another database on the same cluster, e.g. vps_loadtest for
    // load testing. Unset, the database named in MONGODB_URI is used exactly as before.
    await mongoose.connect(process.env.MONGODB_URI, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {});

    console.log(
      "MongoDB Connected successfully to database:",
      mongoose.connection.name,
    );
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

export default connectDB;
