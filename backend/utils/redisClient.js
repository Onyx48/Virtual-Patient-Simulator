import Redis from "ioredis";
import "dotenv/config";

let redisClient;
const redisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  // password: process.env.REDIS_PASSWORD, // Uncomment if you set a Redis password
  lazyConnect: false,
  showFriendlyErrorStack: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    console.log(
      `Redis: Retrying connection (attempt ${times}), delay ${delay}ms`,
    );
    return delay;
  },
  maxRetriesPerRequest: 3,
};

try {
  console.log(
    `Attempting to connect to Redis at ${redisOptions.host}:${redisOptions.port}...`,
  );
  redisClient = new Redis(redisOptions);

  redisClient.on("connect", () => {
    console.log('✅ Redis client: "connect" event - Connection established.');
  });

  redisClient.on("ready", () => {
    console.log(
      '✅ Redis client: "ready" event - Client is ready to use commands.',
    );
  });

  redisClient.on("error", (err) => {
    console.error("❌ Redis Client Error:", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error(
        "    ECONNREFUSED: Make sure Redis server is running and accessible.",
      );
    } else if (err.code === "ENOTFOUND") {
      console.error(
        `   ENOTFOUND: Hostname ${redisOptions.host} not found. Check REDIS_HOST.`,
      );
    }
  });

  redisClient.on("reconnecting", (delay) => {
    console.warn(`Redis client: Reconnecting in ${delay}ms...`);
  });

  redisClient.on("end", () => {
    console.warn("Redis client: Connection has been closed.");
  });
} catch (error) {
  console.error("❌ Critical error initializing Redis client:", error);
  redisClient = null;
}

export default redisClient;
