module.exports = {
  apps: [
    {
      name: "jewel-VTO-store",
      script: "npm",
      args: "run start", // Starts the Next.js server
      exec_mode: "cluster", // Enables multiple instances
      instances: "max", // Runs on all available CPU cores
      env: {
        PORT: 3020, // Port where the app will run
        NODE_ENV: "production", // Environment
      },
    },
  ],
};
