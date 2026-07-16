module.exports = {
  apps: [
    {
      name: "test-galczynski-inktelligence",
      cwd: "/var/www/test.galczynski.guru",
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3019",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
