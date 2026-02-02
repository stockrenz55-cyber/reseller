const express = require("express");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cfg = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= DATABASE IN-MEMORY ================= */
const users = {
  owner: {
    username: "owner",
    password: bcrypt.hashSync("owner123", 10),
    role: "owner",
    device: null
  }
};

/* ================= RESOURCE MAP (BOT 1:1) ================= */
const resourceMap = {
  "1gb": { ram: 1000, disk: 1000, cpu: 40 },
  "2gb": { ram: 2000, disk: 1000, cpu: 60 },
  "3gb": { ram: 3000, disk: 2000, cpu: 80 },
  "4gb": { ram: 4000, disk: 2000, cpu: 100 },
  "5gb": { ram: 5000, disk: 3000, cpu: 120 },
  "6gb": { ram: 6000, disk: 3000, cpu: 140 },
  "7gb": { ram: 7000, disk: 4000, cpu: 160 },
  "8gb": { ram: 8000, disk: 4000, cpu: 180 },
  "9gb": { ram: 9000, disk: 5000, cpu: 200 },
  "10gb": { ram: 10000, disk: 5000, cpu: 220 },
  "unlimited": { ram: 0, disk: 0, cpu: 0 },
  "unli": { ram: 0, disk: 0, cpu: 0 }
};

/* ================= AUTH ================= */
function auth(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.sendStatus(401);
    try {
      const d = jwt.verify(token, cfg.JWT_SECRET);
      if (roles.length && !roles.includes(d.role))
        return res.sendStatus(403);
      req.user = d;
      next();
    } catch {
      res.sendStatus(401);
    }
  };
}

/* ================= LOGIN + DEVICE LOCK ================= */
app.post("/login", (req, res) => {
  const { username, password, deviceId } = req.body;
  const u = users[username];
  if (!u) return res.status(401).json({ msg: "User tidak ada" });
  if (!bcrypt.compareSync(password, u.password))
    return res.status(401).json({ msg: "Password salah" });

  if (u.device && u.device !== deviceId)
    return res.status(403).json({ msg: "Akun sudah login di device lain" });

  u.device = deviceId;
  const token = jwt.sign({ username, role: u.role }, cfg.JWT_SECRET, {
    expiresIn: "12h"
  });
  res.json({ token, role: u.role });
});

/* ================= CREATE AKUN (OWNER / ADMIN) ================= */
app.post("/user/create", auth(["owner", "admin"]), (req, res) => {
  const { username, password, role } = req.body;
  if (users[username]) return res.json({ msg: "User sudah ada" });
  if (req.user.role === "admin" && role !== "reseller")
    return res.sendStatus(403);

  users[username] = {
    username,
    password: bcrypt.hashSync(password, 10),
    role,
    device: null
  };
  res.json({ msg: "User dibuat" });
});

/* ================= CREATE PANEL (1GB–UNLI) ================= */
app.post("/panel/create", auth(["owner", "admin", "reseller"]), async (req, res) => {
  const { paket, username } = req.body;
  const spec = resourceMap[paket];
  if (!spec) return res.json({ msg: "Paket tidak valid" });

  const email = username + "@gmail.com";
  const password = username + "001";

  try {
    // create user panel
    const u = await fetch(cfg.domain + "/api/application/users", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + cfg.apikey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: "Server",
        password
      })
    }).then(r => r.json());

    if (u.errors) return res.json(u.errors);

    // get egg startup
    const egg = await fetch(
      `${cfg.domain}/api/application/nests/${cfg.nestid}/eggs/${cfg.egg}`,
      {
        headers: {
          Authorization: "Bearer " + cfg.apikey,
          "Content-Type": "application/json"
        }
      }
    ).then(r => r.json());

    // create server
    const s = await fetch(cfg.domain + "/api/application/servers", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + cfg.apikey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: username + " Server",
        user: u.attributes.id,
        egg: cfg.egg,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
        startup: egg.attributes.startup,
        limits: {
          memory: spec.ram,
          disk: spec.disk,
          cpu: spec.cpu,
          swap: 0,
          io: 500
        },
        feature_limits: { databases: 5, backups: 5, allocations: 5 },
        deploy: { locations: [cfg.loc], dedicated_ip: false }
      })
    }).then(r => r.json());

    res.json({
      msg: "Panel berhasil dibuat",
      panel: {
        username,
        password,
        ram: spec.ram,
        disk: spec.disk,
        cpu: spec.cpu
      }
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

/* ================= LIST PANEL ================= */
app.get("/panel/list", auth(["owner", "admin", "reseller"]), async (req, res) => {
  const r = await fetch(cfg.domain + "/api/application/servers", {
    headers: { Authorization: "Bearer " + cfg.apikey }
  }).then(r => r.json());
  res.json(r.data);
});

/* ================= DELETE PANEL ================= */
app.post("/panel/delete", auth(["owner"]), async (req, res) => {
  const { id } = req.body;
  await fetch(cfg.domain + `/api/application/servers/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + cfg.apikey }
  });
  res.json({ msg: "Panel dihapus" });
});

/* ================= DELETE ALL PANEL ================= */
app.post("/panel/delete-all", auth(["owner"]), async (req, res) => {
  const r = await fetch(cfg.domain + "/api/application/servers", {
    headers: { Authorization: "Bearer " + cfg.apikey }
  }).then(r => r.json());

  for (const s of r.data) {
    await fetch(cfg.domain + `/api/application/servers/${s.attributes.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + cfg.apikey }
    });
  }
  res.json({ msg: "Semua panel dihapus" });
});

app.listen(cfg.PORT, () =>
  console.log("SERVER JALAN PORT", cfg.PORT)
);
