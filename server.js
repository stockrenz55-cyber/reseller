const express = require("express");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const cors = require("cors");
const config = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

let USERS = {};   // username -> { pass, role, device }
let LOGS = [];

function log(type, msg) {
  const t = new Date().toISOString();
  LOGS.unshift(`[${t}] [${type}] ${msg}`);
  if (LOGS.length > 300) LOGS.pop();
  console.log(LOGS[0]);
}

/* ================= LOGIN ================= */
app.post("/login", (req, res) => {
  const { username, password, device } = req.body;

  if (username === config.OWNER_USER && password === config.OWNER_PASS) {
    USERS[username] ??= { role: "owner", device: null };
  }

  const user = USERS[username];
  if (!user || user.pass && user.pass !== password) {
    log("LOGIN_FAIL", username);
    return res.status(401).json({ error: "Username / Password salah" });
  }

  if (user.device && user.device !== device) {
    log("DEVICE_BLOCK", username);
    return res.status(403).json({ error: "Akun sedang login di device lain" });
  }

  user.device = device;

  const token = jwt.sign(
    { username, role: user.role },
    config.JWT_SECRET,
    { expiresIn: "1h" }
  );

  log("LOGIN_OK", username);
  res.json({ token, role: user.role });
});

/* ================= AUTH ================= */
function auth(req, res, next) {
  try {
    const token = req.headers.authorization;
    const data = jwt.verify(token, config.JWT_SECRET);
    req.user = data;
    next();
  } catch {
    res.status(401).json({ error: "Token invalid" });
  }
}

/* ================= CREATE PANEL ================= */
app.post("/create-panel", auth, async (req, res) => {
  try {
    log("CREATE_PANEL", req.user.username);
    res.json({ success: true });
  } catch (e) {
    log("ERROR", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ================= LOG VIEW ================= */
app.get("/logs", auth, (req, res) => {
  res.json(LOGS);
});

app.listen(config.PORT, () =>
  console.log("SERVER RUNNING:", config.PORT)
);
