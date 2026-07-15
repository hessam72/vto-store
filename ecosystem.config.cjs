module.exports = {
  apps: [
    {
      name: "vto-store",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3021",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

  