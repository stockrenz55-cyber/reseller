module.exports = {
  app: {
    port: 3000,
    sessionSecret: "super-secret-neon-session",
  },

  pterodactyl: {
    domain: "https://nyxostudio.web.id",
    apikey: "ptla_mIoA2uJSLrSVm0r3l21x2wTjQee9ZpCR5YjifRufQue",
    capikey: "ptlc_0nPji2uEXI9WuSU6mRmBwwyG8C1TV2yen0eTGkO52Vc",
    egg: 15,
    nestid: 5,
    loc: 1,
  },

  roles: {
    OWNER: "owner",
    ADMIN: "admin",
    RESELLER: "reseller",
  },

  permissions: {
    owner: ["create_user", "delete_user", "create_panel", "delete_panel", "list_panel"],
    admin: ["create_user", "create_panel", "delete_panel", "list_panel"],
    reseller: ["create_panel", "list_panel"],
  }
};
