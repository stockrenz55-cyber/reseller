const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const CONFIG = require("./config");

const app = express();
app.use(bodyParser.json());
app.use(express.static("."));

const resourceMap = {
  "1gb": { ram:1000, disk:1000, cpu:40 },
  "2gb": { ram:2000, disk:1000, cpu:60 },
  "3gb": { ram:3000, disk:2000, cpu:80 },
  "4gb": { ram:4000, disk:2000, cpu:100 },
  "5gb": { ram:5000, disk:3000, cpu:120 },
  "unlimited": { ram:0, disk:0, cpu:0 }
};

app.post("/create-panel", async (req, res) => {
  try {
    const { username, paket } = req.body;
    if (!username) return res.status(400).json({ error: "Username kosong" });

    const spec = resourceMap[paket];
    const email = `${username}@gmail.com`;
    const password = `${username}001`;

    /* ================= CREATE USER ================= */
    const userRes = await fetch(`${CONFIG.domain}/api/application/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.apikey}`,
        Accept: "application/json",
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

    if (userRes.errors) return res.json(userRes);

    /* ================= GET EGG ================= */
    const eggRes = await fetch(
      `${CONFIG.domain}/api/application/nests/${CONFIG.nestid}/eggs/${CONFIG.egg}`,
      {
        headers: {
          Authorization: `Bearer ${CONFIG.apikey}`,
          Accept: "application/json"
        }
      }
    ).then(r => r.json());

    /* ================= CREATE SERVER ================= */
    const serverRes = await fetch(`${CONFIG.domain}/api/application/servers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.apikey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `${username} Server`,
        user: userRes.attributes.id,
        egg: CONFIG.egg,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
        startup: eggRes.attributes.startup,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: {
          memory: spec.ram,
          disk: spec.disk,
          cpu: spec.cpu,
          swap: 0,
          io: 500
        },
        feature_limits: {
          databases: 5,
          backups: 5,
          allocations: 5
        },
        deploy: {
          locations: [CONFIG.loc],
          dedicated_ip: false
        }
      })
    }).then(r => r.json());

    /* ================= AUTO START SERVER (CAPIKEY) ================= */
    await fetch(
      `${CONFIG.domain}/api/client/servers/${serverRes.attributes.identifier}/power`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CONFIG.capikey}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ signal: "start" })
      }
    );

    res.json({
      success: true,
      username,
      password,
      spec,
      panel: CONFIG.domain,
      server_id: serverRes.attributes.id
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => {
  console.log("✅ Panel Creator running → http://localhost:3000");
});
