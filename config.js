// config.js
module.exports = {
  domain: "https://nyxostudio.web.id", // Ganti dengan domain Pterodactyl kamu
  apikey: "ptla_mIoA2uJSLrSVm0r3l21x2wTjQee9ZpCR5YjifRufQue",          // Pastikan pakai admin API key
  capikey: "ptlc_0nPji2uEXI9WuSU6mRmBwwyG8C1TV2yen0eTGkO52Vc",        // Opsional, client key
  egg: 15,        // ID Egg (sesuaikan)
  nestid: 5,      // ID Nest (sesuaikan)
  loc: 1,         // Location ID Ptero
  resourceMap: {
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
  }
};
