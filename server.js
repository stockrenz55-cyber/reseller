import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ============ CONFIG ============
const CONFIG = {
  domain: "https://nyxostudio.web.id",
  apikey: "ptla_mIoA2uJSLrSVm0r3l21x2wTjQee9ZpCR5YjifRufQue",
  capikey: "ptlc_0nPji2uEXI9WuSU6mRmBwwyG8C1TV2yen0eTGkO52Vc",
  egg: 15,
  nestid: 5,
  loc: 1
};

const resourceMap = {
  "1gb":{ram:1000,disk:1000,cpu:40},
  "2gb":{ram:2000,disk:1000,cpu:60},
  "3gb":{ram:3000,disk:2000,cpu:80},
  "4gb":{ram:4000,disk:2000,cpu:100},
  "5gb":{ram:5000,disk:3000,cpu:120},
  "unlimited":{ram:0,disk:0,cpu:0}
};

// ============ CREATE PANEL ============
app.post("/create-panel", async (req,res)=>{
  try{
    const { username, paket } = req.body;
    if(!username) throw "Username kosong";
    if(!resourceMap[paket]) throw "Paket tidak valid";

    const spec = resourceMap[paket];
    const email = username+"@gmail.com";
    const password = username+"001";

    // CREATE USER
    const u = await fetch(CONFIG.domain+"/api/application/users",{
      method:"POST",
      headers:{
        "Authorization":"Bearer "+CONFIG.apikey,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: "Server",
        language: "en",
        password
      })
    });
    const udata = await u.json();
    if(udata.errors) throw "Username sudah terdaftar";

    // GET EGG
    const e = await fetch(
      `${CONFIG.domain}/api/application/nests/${CONFIG.nestid}/eggs/${CONFIG.egg}`,
      { headers:{ Authorization:"Bearer "+CONFIG.apikey } }
    );
    const edata = await e.json();

    // CREATE SERVER
    const s = await fetch(CONFIG.domain+"/api/application/servers",{
      method:"POST",
      headers:{
        "Authorization":"Bearer "+CONFIG.apikey,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        name: username+" Server",
        user: udata.attributes.id,
        egg: CONFIG.egg,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
        startup: edata.attributes.startup,
        limits:{
          memory: spec.ram,
          disk: spec.disk,
          cpu: spec.cpu,
          swap: 0,
          io: 500
        },
        feature_limits:{ databases:5, backups:5, allocations:5 },
        deploy:{ locations:[CONFIG.loc], dedicated_ip:false, port_range:[] }
      })
    });
    const sdata = await s.json();
    if(sdata.errors) throw "Gagal membuat server";

    res.json({
      success:true,
      username,
      password,
      ram: spec.ram==0?"Unlimited":spec.ram/1000+"GB",
      disk: spec.disk==0?"Unlimited":spec.disk/1000+"GB",
      cpu: spec.cpu==0?"Unlimited":spec.cpu+"%",
      server_id: sdata.attributes.id,
      panel: CONFIG.domain,
      capikey_used: true
    });

  }catch(err){
    res.json({ success:false, error:String(err) });
  }
});

app.listen(3000,()=>{
  console.log("✔ Backend aktif di http://localhost:3000");
});
