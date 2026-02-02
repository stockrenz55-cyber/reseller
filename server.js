const express = require("express");
const fetch = require("node-fetch");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cfg = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SIMPLE DB ================= */
const users = {};
users[cfg.OWNER.username] = {
  username: cfg.OWNER.username,
  password: bcrypt.hashSync(cfg.OWNER.password, 10),
  role: "owner",
  device: null
};

/* ================= RESOURCE MAP ================= */
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
  "unlimited": { ram: 0, disk: 0, cpu: 0 }
};

/* ================= LOG ERROR ================= */
function logError(place, err) {
  console.error(`\n[ERROR @ ${place}]`);
  console.error(err);
}

/* ================= AUTH ================= */
function auth(roles = []) {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token" });

      const decoded = jwt.verify(token, cfg.JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role))
        return res.status(403).json({ error: "Forbidden" });

      req.user = decoded;
      next();
    } catch (e) {
      logError("AUTH", e);
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

/* ================= LOGIN ================= */
app.post("/login", (req, res) => {
  try {
    const { username, password, deviceId } = req.body;
    const user = users[username];

    if (!user) return res.status(401).json({ error: "User tidak ada" });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Password salah" });

    if (user.device && user.device !== deviceId)
      return res.status(403).json({ error: "Akun login di device lain" });

    user.device = deviceId;

    const token = jwt.sign(
      { username, role: user.role },
      cfg.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, role: user.role });
  } catch (e) {
    logError("LOGIN", e);
    res.status(500).json({ error: "Login error" });
  }
});

/* ================= CREATE USER ================= */
app.post("/user/create", auth(["owner", "admin"]), (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (users[username])
      return res.status(400).json({ error: "User sudah ada" });

    if (req.user.role === "admin" && role !== "reseller")
      return res.status(403).json({ error: "Admin hanya boleh buat reseller" });

    users[username] = {
      username,
      password: bcrypt.hashSync(password, 10),
      role,
      device: null
    };

    res.json({ success: true });
  } catch (e) {
    logError("CREATE USER", e);
    res.status(500).json({ error: "Create user error" });
  }
});

/* ================= CREATE PANEL ================= */
app.post("/panel/create", auth(["owner", "admin", "reseller"]), async (req, res) => {
  const { paket, username } = req.body;
  const spec = resourceMap[paket];
  if (!spec) return res.status(400).json({ error: "Paket tidak valid" });

  try {
    const email = `${username}@gmail.com`;
    const password = `${username}001`;

    const u = await fetch(cfg.PTERO.DOMAIN + "/api/application/users", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + cfg.PTERO.API_KEY,
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

    if (u.errors) {
      logError("PTERO USER", u.errors);
      return res.status(500).json(u.errors);
    }

    res.json({
      success: true,
      panel: {
        username,
        password,
        ram: spec.ram,
        disk: spec.disk,
        cpu: spec.cpu
      }
    });
  } catch (e) {
    logError("CREATE PANEL", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(cfg.PORT, () =>
  console.log("SERVER RUNNING PORT", cfg.PORT)
);
