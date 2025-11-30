import dotenv from "dotenv";
import logger from "./config/logger";
import { shutdown } from "./services";
import app from "./app";
import { initAgent } from "./Agent/index";

dotenv.config();

async function startServer() {
  try {
    await initAgent();
  } catch (err) {
    logger.error("Error during agent initialization:", err);
    process.exit(1);
  }

  const PORT = process.env.PORT || 5000;
  const HOST = '0.0.0.0';
  
  const server = app.listen(PORT, HOST, () => {
    logger.info(`Server is running on ${HOST}:${PORT}`);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM signal.");
    shutdown(server);
  });
  process.on("SIGINT", () => {
    logger.info("Received SIGINT signal.");
    shutdown(server);
  });
}

startServer();
