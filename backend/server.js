import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { sequelize, dbKind } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", db: dbKind });
  } catch (error) {
    res.status(500).json({ status: "error", db: dbKind, message: error.message });
  }
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the backend 👋" });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT} (db: ${dbKind})`);
});
