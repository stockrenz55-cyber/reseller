const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const crypto = require("crypto");
const fs = require("fs");

const config = require("./config");
const app = express();

app.use(bodyParser.json());
app.use(express.static("."));

app.use(
  session({
    secret: config.app.sessionSecret,
    resave: false,
    saveUninitialized: false,
  })
);

// ================= DATABASE SIMPLE (JSON) =================
const DB_FILE = "./users.json";
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      [
        {
          username: "owner",
          password: "owner123",
          role: "owner",
          device: null,
        },
      ],
      null,
      2
    )
  );
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveUsers(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ================= AUTH =================
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

function requirePermission(action) {
  return (req, res, next) => {
    const role = req.session.user.role;
    if (!config.permissions[role].includes(action)) {
      return res.status(403).json({ error: "No permission" });
    }
    next();
  };
}

// ================= LOGIN =================
app.post("/api/login", (req, res) => {
  const { username, password, device } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Login gagal" });

  if (user.device && user.device !== device) {
    return res.status(403).json({ error: "Akun sedang login di device lain" });
  }

  user.device = device;
  saveUsers(users);

  req.session.user = {
    username: user.username,
    role: user.role,
  };

  res.json({ success: true, role: user.role });
});

// ================= LOGOUT =================
app.post("/api/logout", requireLogin, (req, res) => {
  const users = loadUsers();
  const u = users.find(x => x.username === req.session.user.username);
  if (u) {
    u.device = null;
    saveUsers(users);
  }
  req.session.destroy(() => {});
  res.json({ success: true });
});

// ================= CREATE USER (OWNER / ADMIN) =================
app.post(
  "/api/create-user",
  requireLogin,
  requirePermission("create_user"),
  (req, res) => {
    const { username, password, role } = req.body;
    const users = loadUsers();
    if (users.find(u => u.username === username))
      return res.status(400).json({ error: "User sudah ada" });

    users.push({ username, password, role, device: null });
    saveUsers(users);
    res.json({ success: true });
  }
);

// ================= CREATE PANEL =================
app.post(
  "/api/create-panel",
  requireLogin,
  requirePermission("create_panel"),
  async (req, res) => {
    const { username, ram } = req.body;

    const resourceMap = {
      "1gb": { ram: 1000, disk: 1000, cpu: 40 },
      "2gb": { ram: 2000, disk: 1000, cpu: 60 },
      "3gb": { ram: 3000, disk: 2000, cpu: 80 },
      "4gb": { ram: 4000, disk: 2000, cpu: 100 },
      "5gb": { ram: 5000, disk: 3000, cpu: 120 },
      "10gb": { ram: 10000, disk: 5000, cpu: 220 },
      "unlimited": { ram: 0, disk: 0, cpu: 0 },
    };

    const spec = resourceMap[ram];
    if (!spec) return res.status(400).json({ error: "RAM invalid" });

    try {
      const email = `${username}@gmail.com`;
      const password = username + "001";

      const userRes = await fetch(
        `${config.pterodactyl.domain}/api/application/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.pterodactyl.apikey}`,
          },
          body: JSON.stringify({
            email,
            username,
            first_name: username,
            last_name: "Server",
            language: "en",
            password,
          }),
        }
      );
      const userData = await userRes.json();
      if (userData.errors) return res.json(userData);

      const serverRes = await fetch(
        `${config.pterodactyl.domain}/api/application/servers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.pterodactyl.apikey}`,
          },
          body: JSON.stringify({
            name: `${username} Server`,
            user: userData.attributes.id,
            egg: config.pterodactyl.egg,
            docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
            limits: {
              memory: spec.ram,
              disk: spec.disk,
              cpu: spec.cpu,
              swap: 0,
              io: 500,
            },
            feature_limits: {
              databases: 5,
              backups: 5,
              allocations: 5,
            },
            deploy: {
              locations: [config.pterodactyl.loc],
              dedicated_ip: false,
            },
          }),
        }
      );

      const serverData = await serverRes.json();
      res.json({
        success: true,
        panel: serverData.attributes,
        login: { username, password },
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

app.listen(config.app.port, () => {
  console.log("Reseller panel running on port " + config.app.port);
});)
