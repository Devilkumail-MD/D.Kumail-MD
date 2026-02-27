const fs = require("fs");
const path = require("path");

async function preloadDKMLSessions() {
  const sessionEnv = process.env.SESSION || process.env.SESSION_ID || "";
  const sessionUrl = process.env.SESSION_URL || "";
  const sessions = sessionEnv.split(",").map((s) => s.trim()).filter(Boolean);

  const dkmlSessions = sessions.filter((s) => s.startsWith("DKML~"));
  if (dkmlSessions.length === 0) return;

  if (!sessionUrl) {
    console.log("⚠️ SESSION_URL required for DKML~ sessions. Set it to your session generator website URL.");
    return;
  }

  const axios = require("axios");
  const { sequelize } = require("../config");
  const { DataTypes } = require("sequelize");

  const WhatsappSession = sequelize.define("WhatsappSession", {
    sessionId: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    sessionData: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue("sessionData");
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
      },
      set(value) {
        try { this.setDataValue("sessionData", value ? JSON.stringify(value) : null); } catch { this.setDataValue("sessionData", null); }
      },
    },
  }, { timestamps: false });

  try {
    await sequelize.authenticate();
    await WhatsappSession.sync();
  } catch (err) {
    console.error("Session loader: DB error:", err.message);
    return;
  }

  for (const fullId of dkmlSessions) {
    const shortId = fullId.replace("DKML~", "");

    const existing = await WhatsappSession.findOne({ where: { sessionId: `creds-${shortId}` } });
    if (existing && existing.sessionData) {
      console.log(`  ✓ Session ${shortId.substring(0, 8)}... already loaded`);
      continue;
    }

    console.log(`  ↓ Downloading session ${shortId.substring(0, 8)}...`);
    try {
      const url = `${sessionUrl.replace(/\/$/, "")}/api/session/${shortId}`;
      const response = await axios.get(url, { timeout: 15000 });

      if (response.data && response.data.data) {
        let credsData;
        if (typeof response.data.data === "string") {
          credsData = JSON.parse(response.data.data);
        } else {
          credsData = response.data.data;
        }

        await WhatsappSession.upsert({ sessionId: `creds-${shortId}`, sessionData: credsData });
        await WhatsappSession.upsert({ sessionId: `creds`, sessionData: credsData });

        console.log(`  ✓ Session ${shortId.substring(0, 8)}... downloaded & saved to database`);
      } else {
        console.error(`  ✗ Session ${shortId.substring(0, 8)}... not found on server`);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        console.error(`  ✗ Session ${shortId.substring(0, 8)}... not found or expired. Generate a new one.`);
      } else {
        console.error(`  ✗ Session ${shortId.substring(0, 8)}... download failed: ${err.message}`);
      }
    }
  }
}

module.exports = { preloadDKMLSessions };
