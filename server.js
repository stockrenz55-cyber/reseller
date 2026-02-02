const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
const bodyParser = require("body-parser");
const path = require("path");
const cfg = require("./config");

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ================= AUTH =================
const sessions = {};
function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ","");
  if (!token || !sessions[token]) {
    return res.status(403).json({ msg: "Unauthorized" });
  }
  next();
}

// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { username, password, device } = req.body;
  if (password !== username + "001") return res.status(401).json({ msg: "Login gagal" });

  if (Object.values(sessions).find(s => s.username === username)) {
    return res.status(403).json({ msg: "Akun sudah login di device lain" });
  }

  const token = Date.now() + "-" + Math.random();
  sessions[token] = { username, device };
  res.json({ token });
});

// ================= CREATE PANEL =================
app.post("/create", auth, async (req, res) => {
  const { username, paket } = req.body;
  const spec = cfg.resourceMap[paket];
  if (!spec) return res.status(400).json({ msg: "Paket tidak valid" });

  try {
    // CREATE USER
    const u = await fetch(`${cfg.domain}/api/application/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apikey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${username}@gmail.com`,
        username,
        first_name: username,
        last_name: "Panel",
        password: username + "001"
      })
    });
    const user = (await u.json()).attributes;

    // GET STARTUP
    const egg = await fetch(`${cfg.domain}/api/application/nests/${cfg.nestid}/eggs/${cfg.egg}`, {
      headers: { Authorization: `Bearer ${cfg.apikey}` }
    });
    const startup = (await egg.json()).attributes.startup;

    // CREATE SERVER
    const s = await fetch(`${cfg.domain}/api/application/servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apikey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${username} Server`,
        user: user.id,
        egg: cfg.egg,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
        startup,
        limits: { memory: spec.ram, disk: spec.disk, cpu: spec.cpu, swap: 0, io: 500 },
        feature_limits: { databases: 5, backups: 5, allocations: 5 },
        deploy: { locations: [cfg.loc], dedicated_ip: false }
      })
    });
    const server = (await s.json()).attributes;

    res.json({ user, server, panel_url: cfg.domain });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ================= START =================
app.listen(3000, () => console.log("✅ WEB PANEL RUNNING http://localhost:3000"));
