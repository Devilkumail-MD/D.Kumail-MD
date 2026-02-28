const path = require("path");
const fs = require("fs");
if (fs.existsSync("./config.env")) {
  require("dotenv").config({ path: "./config.env" });
}

const sessionUrl = process.env.SESSION_URL || "";
if (sessionUrl) {
  try {
    const axios = require("axios");
    const origGet = axios.get.bind(axios);
    axios.get = function(url, ...args) {
      if (typeof url === "string" && url.includes("raganork.site/api/fetch-session")) {
        const idMatch = url.match(/[?&]id=([^&]+)/);
        if (idMatch) {
          const newUrl = `${sessionUrl.replace(/\/$/, "")}/api/fetch-session?id=${idMatch[1]}`;
          console.log(`  → Redirecting session fetch to: ${newUrl}`);
          return origGet(newUrl, ...args);
        }
      }
      return origGet(url, ...args);
    };
    console.log("- Session URL redirect active:", sessionUrl);
  } catch (e) {
    console.log("- Axios interceptor skip:", e.message);
  }
}

try {
  const { CustomAuthState } = require("./core/auth");
  const origLoadSession = CustomAuthState.prototype.loadSession;
  CustomAuthState.prototype.loadSession = async function() {
    await origLoadSession.call(this);

    if (!this.sessionData.creds || Object.keys(this.sessionData.creds).length === 0) {
      console.log(`- [${this.sessionId}] Auth state empty after fetch, loading from database...`);
      try {
        const { sequelize } = require("./config");
        const keysToTry = [`creds-${this.sessionId}`, `${this.sessionId}-creds`, "creds"];
        let credsData = null;

        const tables = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table'", { type: sequelize.QueryTypes ? sequelize.QueryTypes.SELECT : "SELECT" });
        const tableNames = tables.map(t => t.name || t.tbl_name);
        console.log(`  ? Tables in DB: ${tableNames.join(", ")}`);

        const tableName = tableNames.find(t => t.toLowerCase().includes("whatsapp")) || "WhatsappSessions";
        console.log(`  ? Using table: ${tableName}`);

        for (const key of keysToTry) {
          console.log(`  ? Trying DB key: ${key}`);
          try {
            const rows = await sequelize.query(
              `SELECT sessionData FROM "${tableName}" WHERE sessionId = ?`,
              { replacements: [key], type: "SELECT" }
            );
            const resultRows = Array.isArray(rows[0]) ? rows[0] : rows;
            if (resultRows.length > 0 && resultRows[0].sessionData) {
              console.log(`  ? Found row, data type: ${typeof resultRows[0].sessionData}, preview: ${String(resultRows[0].sessionData).substring(0, 80)}`);
              try {
                credsData = typeof resultRows[0].sessionData === "string" ? JSON.parse(resultRows[0].sessionData) : resultRows[0].sessionData;
              } catch (parseErr) {
                console.log(`  ? Parse error: ${parseErr.message}`);
                credsData = null;
              }
              if (credsData && typeof credsData === "object" && Object.keys(credsData).length > 0) {
                console.log(`  ✓ Found creds in DB key: ${key} (${Object.keys(credsData).length} keys)`);
                break;
              }
              credsData = null;
            } else {
              console.log(`  ? Key ${key}: no data (${resultRows.length} rows)`);
            }
          } catch (qErr) {
            console.log(`  ? Query error for ${key}: ${qErr.message}`);
          }
        }

        if (credsData) {
          const baileys = require("baileys");
          const revived = JSON.parse(JSON.stringify(credsData), baileys.BufferJSON.reviver);
          this.sessionData.creds = revived;
          this.sessionData.dirty = true;
          console.log(`  ✓ Session ${this.sessionId} loaded from database (${Object.keys(revived).length} keys, registered=${revived.registered})`);
        } else {
          console.log(`  ✗ No creds found in database for ${this.sessionId}`);
        }
      } catch (dbErr) {
        console.error(`  ✗ DB load error for ${this.sessionId}:`, dbErr.message);
      }
    }
  };
  console.log("- Auth loadSession patch active");
} catch (e) {
  console.log("- Auth patch skip:", e.message);
}

const { suppressLibsignalLogs } = require("./core/helpers");

suppressLibsignalLogs();

const { initializeDatabase } = require("./core/database");
const { BotManager } = require("./core/manager");
const config = require("./config");
const { SESSION, logger } = config;
const http = require("http");
const {
  ensureTempDir,
  TEMP_DIR,
  initializeKickBot,
  cleanupKickBot,
} = require("./core/helpers");

async function main() {
  ensureTempDir();
  logger.info(`Created temporary directory at ${TEMP_DIR}`);
  console.log(`D.Kumail MD v${require("./package.json").version}`);
  console.log(`- Configured sessions: ${SESSION.join(", ")}`);
  logger.info(`Configured sessions: ${SESSION.join(", ")}`);
  if (SESSION.length === 0) {
    const warnMsg =
      "⚠️ No sessions configured. Please set SESSION environment variable.";
    console.warn(warnMsg);
    logger.warn(warnMsg);
    return;
  }

  try {
    const { preloadDKMLSessions } = require("./core/session-loader");
    await preloadDKMLSessions();
  } catch (err) {
    console.log("Session pre-loader:", err.message);
  }

  try {
    await initializeDatabase();
    console.log("- Database initialized");
    logger.info("Database initialized successfully.");

    try {
      const { WhatsappSession } = require("./core/database");
      const allSessions = await WhatsappSession.findAll({ attributes: ['sessionId'] });
      const keys = allSessions.map(s => s.sessionId);
      console.log(`- DB session keys (${keys.length}):`, keys.join(', '));
    } catch (dbgErr) {
      console.log("- DB debug error:", dbgErr.message);
    }
  } catch (dbError) {
    console.error(
      "🚫 Failed to initialize database or load configuration. Bot cannot start.",
      dbError
    );
    logger.fatal(
      "🚫 Failed to initialize database or load configuration. Bot cannot start.",
      dbError
    );
    process.exit(1);
  }

  const botManager = new BotManager();

  const shutdownHandler = async (signal) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    logger.info(`Received ${signal}, shutting down...`);
    cleanupKickBot();
    await botManager.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdownHandler("SIGINT"));
  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));

  await botManager.initializeBots();
  console.log("- Bot initialization complete.");
  logger.info("Bot initialization complete");

  const sendDeployMessage = async () => {
    try {
      const sudoNumbers = (config.SUDO || "").split(",").map(n => n.trim()).filter(Boolean);
      if (sudoNumbers.length === 0) return;

      await new Promise(resolve => setTimeout(resolve, 10000));

      for (const [sessionId, bot] of botManager.bots.entries()) {
        if (bot.sock) {
          for (const num of sudoNumbers) {
            const jid = num.includes("@") ? num : `${num}@s.whatsapp.net`;
            try {
              await bot.sock.sendMessage(jid, {
                text: `✅ *D.Kumail MD Bot Successfully Deployed!*\n\n_Bot is now online and ready._\n\nType *.menu* to get started.`
              });
              logger.info(`Deploy success message sent to ${num}`);
            } catch (err) {
              logger.error(`Failed to send deploy message to ${num}: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      logger.error("Deploy message error:", err.message);
    }
  };

  sendDeployMessage();

  initializeKickBot();

  const startServer = () => {
    const PORT = process.env.PORT || 3000;

    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      } else {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("D.Kumail MD Bot is running!");
      }
    });

    server.listen(PORT, () => {
      logger.info(`Web server listening on port ${PORT}`);
    });
  };

  if (process.env.USE_SERVER !== "false") startServer();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Fatal error in main execution: ${error.message}`, error);
    logger.fatal({ err: error }, `Fatal error in main execution`);
    process.exit(1);
  });
}
