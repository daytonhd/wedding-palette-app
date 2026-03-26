require("dotenv").config();

const path = require("path");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getIsoTimestamp() {
  const now = new Date();
  return now.toISOString();
}

function validateString(value, fieldName) {
  const trimmedValue = typeof value === "string" ? value.trim() : "";

  if (!trimmedValue) {
    throw new Error(`${fieldName} is required`);
  }

  return trimmedValue;
}

function requireAdminAuth(req, res, next) {
  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    return res.status(500).send("Admin credentials are not configured.");
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Access"');
    return res.status(401).send("Authentication required.");
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [username, password] = credentials.split(":");

  if (username !== adminUser || password !== adminPassword) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Access"');
    return res.status(401).send("Invalid credentials.");
  }

  next();
}

app.post("/api/respondents", (req, res) => {
  try {
    const body = req.body;
    const name = validateString(body.name, "name");
    const respondentId = uuidv4();
    const createdAt = getIsoTimestamp();
    const updatedAt = createdAt;

    const insertRespondent = db.prepare(`
      INSERT INTO respondents (
        id,
        name,
        created_at,
        updated_at,
        final_winner_palette_id,
        status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertRespondent.run(
      respondentId,
      name,
      createdAt,
      updatedAt,
      null,
      "in_progress",
    );

    res.status(201).json({
      respondentId,
      name,
      createdAt,
      updatedAt,
      status: "in_progress",
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

app.get("/api/respondents/:respondentId", (req, res) => {
  try {
    const respondentId = validateString(
      req.params.respondentId,
      "respondentId",
    );

    const getRespondent = db.prepare(`
      SELECT
        id,
        name,
        created_at,
        updated_at,
        final_winner_palette_id,
        status
      FROM respondents
      WHERE id = ?
    `);

    const getResponses = db.prepare(`
      SELECT
        id,
        respondent_id,
        round_name,
        matchup_key,
        left_palette_id,
        right_palette_id,
        selected_palette_id,
        created_at,
        updated_at
      FROM responses
      WHERE respondent_id = ?
      ORDER BY created_at ASC
    `);

    const respondent = getRespondent.get(respondentId);

    if (!respondent) {
      return res.status(404).json({
        error: "Respondent not found",
      });
    }

    const responses = getResponses.all(respondentId);

    res.json({
      respondent,
      responses,
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

app.post("/api/respondents/:respondentId/responses", (req, res) => {
  try {
    const respondentId = validateString(
      req.params.respondentId,
      "respondentId",
    );
    const body = req.body;

    const roundName = validateString(body.roundName, "roundName");
    const matchupKey = validateString(body.matchupKey, "matchupKey");
    const leftPaletteId = validateString(body.leftPaletteId, "leftPaletteId");
    const rightPaletteId = validateString(
      body.rightPaletteId,
      "rightPaletteId",
    );
    const selectedPaletteId = validateString(
      body.selectedPaletteId,
      "selectedPaletteId",
    );

    const allowedSelections = [leftPaletteId, rightPaletteId];

    if (!allowedSelections.includes(selectedPaletteId)) {
      throw new Error(
        "selectedPaletteId must match one of the palettes in the matchup",
      );
    }

    const existingRespondent = db
      .prepare(
        `
      SELECT id
      FROM respondents
      WHERE id = ?
    `,
      )
      .get(respondentId);

    if (!existingRespondent) {
      return res.status(404).json({
        error: "Respondent not found",
      });
    }

    const existingResponse = db
      .prepare(
        `
      SELECT id
      FROM responses
      WHERE respondent_id = ? AND matchup_key = ?
    `,
      )
      .get(respondentId, matchupKey);

    const now = getIsoTimestamp();

    if (existingResponse) {
      const updateResponse = db.prepare(`
        UPDATE responses
        SET
          round_name = ?,
          left_palette_id = ?,
          right_palette_id = ?,
          selected_palette_id = ?,
          updated_at = ?
        WHERE respondent_id = ? AND matchup_key = ?
      `);

      updateResponse.run(
        roundName,
        leftPaletteId,
        rightPaletteId,
        selectedPaletteId,
        now,
        respondentId,
        matchupKey,
      );
    } else {
      const responseId = uuidv4();

      const insertResponse = db.prepare(`
        INSERT INTO responses (
          id,
          respondent_id,
          round_name,
          matchup_key,
          left_palette_id,
          right_palette_id,
          selected_palette_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertResponse.run(
        responseId,
        respondentId,
        roundName,
        matchupKey,
        leftPaletteId,
        rightPaletteId,
        selectedPaletteId,
        now,
        now,
      );
    }

    db.prepare(
      `
      UPDATE respondents
      SET updated_at = ?
      WHERE id = ?
    `,
    ).run(now, respondentId);

    const savedResponse = db
      .prepare(
        `
      SELECT
        id,
        respondent_id,
        round_name,
        matchup_key,
        left_palette_id,
        right_palette_id,
        selected_palette_id,
        created_at,
        updated_at
      FROM responses
      WHERE respondent_id = ? AND matchup_key = ?
    `,
      )
      .get(respondentId, matchupKey);

    res.status(201).json(savedResponse);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

app.post("/api/respondents/:respondentId/finalize", (req, res) => {
  try {
    const respondentId = validateString(
      req.params.respondentId,
      "respondentId",
    );
    const body = req.body;

    const finalWinnerPaletteId = validateString(
      body.finalWinnerPaletteId,
      "finalWinnerPaletteId",
    );
    const now = getIsoTimestamp();

    const existingRespondent = db
      .prepare(
        `
      SELECT id
      FROM respondents
      WHERE id = ?
    `,
      )
      .get(respondentId);

    if (!existingRespondent) {
      return res.status(404).json({
        error: "Respondent not found",
      });
    }

    const updateRespondent = db.prepare(`
      UPDATE respondents
      SET
        final_winner_palette_id = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `);

    updateRespondent.run(finalWinnerPaletteId, "completed", now, respondentId);

    const finalizedRespondent = db
      .prepare(
        `
      SELECT
        id,
        name,
        created_at,
        updated_at,
        final_winner_palette_id,
        status
      FROM respondents
      WHERE id = ?
    `,
      )
      .get(respondentId);

    res.json(finalizedRespondent);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

app.get("/admin", requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});

app.get("/api/admin/results", requireAdminAuth, (req, res) => {
  try {
    const respondents = db
      .prepare(
        `
      SELECT
        id,
        name,
        created_at,
        updated_at,
        final_winner_palette_id,
        status
      FROM respondents
      ORDER BY created_at DESC
    `,
      )
      .all();

    const responses = db
      .prepare(
        `
      SELECT
        id,
        respondent_id,
        round_name,
        matchup_key,
        left_palette_id,
        right_palette_id,
        selected_palette_id,
        created_at,
        updated_at
      FROM responses
      ORDER BY created_at ASC
    `,
      )
      .all();

    res.json({
      respondents,
      responses,
    });
  } catch (error) {
    console.error("Failed to fetch admin results:", error);
    res.status(500).json({
      error: "Failed to fetch admin results",
    });
  }
});

app.post("/api/admin/clear", requireAdminAuth, (req, res) => {
  try {
    db.prepare(`DELETE FROM responses`).run();
    db.prepare(`DELETE FROM respondents`).run();

    res.json({
      message: "All results cleared successfully.",
    });
  } catch (error) {
    console.error("Failed to clear admin results:", error);
    res.status(500).json({
      error: "Failed to clear results",
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
