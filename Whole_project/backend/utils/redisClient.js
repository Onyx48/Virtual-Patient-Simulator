// WHOLE_PROJECT/utils/redisClient.js
import Redis from "ioredis";
import "dotenv/config";

let redisClient;
const redisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  // password: process.env.REDIS_PASSWORD, // Uncomment if you set a Redis password
  lazyConnect: false, // Let's try connecting immediately for clearer startup status
  showFriendlyErrorStack: true, // Helpful for debugging ioredis errors
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000); // delay will be 50, 100, 150 ... up to 2 sec
    console.log(
      `Redis: Retrying connection (attempt ${times}), delay ${delay}ms`
    );
    return delay;
  },
  maxRetriesPerRequest: 3, // Optional: Limit retries for individual commands
};

try {
  console.log(
    `Attempting to connect to Redis at ${redisOptions.host}:${redisOptions.port}...`
  );
  redisClient = new Redis(redisOptions);

  redisClient.on("connect", () => {
    console.log('✅ Redis client: "connect" event - Connection established.');
  });

  redisClient.on("ready", () => {
    // This is the best indicator that Redis is usable
    console.log(
      '✅ Redis client: "ready" event - Client is ready to use commands.'
    );
  });

  redisClient.on("error", (err) => {
    console.error("❌ Redis Client Error:", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error(
        "    ECONNREFUSED: Make sure Redis server is running and accessible."
      );
    } else if (err.code === "ENOTFOUND") {
      console.error(
        `   ENOTFOUND: Hostname ${redisOptions.host} not found. Check REDIS_HOST.`
      );
    }
    // The client will attempt to reconnect based on retryStrategy
  });

  redisClient.on("reconnecting", (delay) => {
    console.warn(`Redis client: Reconnecting in ${delay}ms...`);
  });

  redisClient.on("end", () => {
    console.warn("Redis client: Connection has been closed.");
  });
} catch (error) {
  console.error("❌ Critical error initializing Redis client:", error);
  redisClient = null; // Ensure client is null if initialization fails catastrophically
}

export default redisClient;
