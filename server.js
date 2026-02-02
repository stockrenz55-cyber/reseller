const express = require("express")
const fetch = require("node-fetch")
const crypto = require("crypto")
const config = require("./config")

const app = express()
app.use(express.json())
app.use(express.static(__dirname))

// ================= DATABASE SEDERHANA =================
const webUsers = [] // akun login web reseller
const sessions = {} // username -> fingerprint

// ================= MIDDLEWARE =================
function auth(req, res, next) {
  const { username, fingerprint } = req.headers
  if (!sessions[username] || sessions[username] !== fingerprint)
    return res.status(401).json({ error: "Session invalid / login di device lain" })

  req.user = webUsers.find(u => u.username === username)
  next()
}

function role(...r) {
  return (req, res, next) => {
    if (!r.includes(req.user.role))
      return res.status(403).json({ error: "Forbidden" })
    next()
  }
}

// ================= LOGIN OWNER / ADMIN PANEL =================
app.post("/login-panel", async (req, res) => {
  const { username, password, fingerprint } = req.body

  const r = await fetch(`${config.pterodactyl.domain}/api/client/account`, {
    headers: {
      Authorization: `Bearer ${config.pterodactyl.capikey}`,
      Accept: "application/json"
    }
  })

  if (!r.ok) return res.json({ error: "Login panel gagal" })

  if (sessions[username] && sessions[username] !== fingerprint)
    return res.json({ error: "Akun sudah login di device lain" })

  sessions[username] = fingerprint

  if (!webUsers.find(u => u.username === username)) {
    webUsers.push({ username, role: "owner" })
  }

  res.json({ success: true, role: "owner" })
})

// ================= CREATE AKUN LOGIN WEB =================
app.post("/create-webuser", auth, role("owner", "admin"), (req, res) => {
  const { username, password, role: r } = req.body

  if (req.user.role === "admin" && r === "admin")
    return res.json({ error: "Admin tidak bisa create admin" })

  webUsers.push({ username, password, role: r })
  res.json({ success: true })
})

// ================= CREATE PANEL (COPY BOT) =================
app.post("/create-panel", auth, role("owner", "admin", "reseller"), async (req, res) => {
  const { paket, username } = req.body

  const resourceMap = {
    "1gb": { ram: "1000", disk: "1000", cpu: "40" },
    "2gb": { ram: "2000", disk: "1000", cpu: "60" },
    "3gb": { ram: "3000", disk: "2000", cpu: "80" },
    "4gb": { ram: "4000", disk: "2000", cpu: "100" },
    "5gb": { ram: "5000", disk: "3000", cpu: "120" },
    "6gb": { ram: "6000", disk: "3000", cpu: "140" },
    "7gb": { ram: "7000", disk: "4000", cpu: "160" },
    "8gb": { ram: "8000", disk: "4000", cpu: "180" },
    "9gb": { ram: "9000", disk: "5000", cpu: "200" },
    "10gb": { ram: "10000", disk: "5000", cpu: "220" },
    "unlimited": { ram: "0", disk: "0", cpu: "0" }
  }

  const r = resourceMap[paket]
  if (!r) return res.json({ error: "Paket invalid" })

  const email = `${username}@gmail.com`
  const password = `${username}001`

  try {
    const u = await fetch(`${config.pterodactyl.domain}/api/application/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pterodactyl.apikey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: "Server",
        password
      })
    })

    const user = (await u.json()).attributes

    await fetch(`${config.pterodactyl.domain}/api/application/servers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pterodactyl.apikey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `${username} Server`,
        user: user.id,
        egg: config.pterodactyl.egg,
        docker_image: config.pterodactyl.docker,
        limits: r,
        deploy: { locations: [config.pterodactyl.location] }
      })
    })

    res.json({ success: true, username, password })
  } catch (e) {
    res.json({ error: e.message })
  }
})

app.listen(config.web.port, () =>
  console.log("WEB PANEL RESELLER RUNNING")
)