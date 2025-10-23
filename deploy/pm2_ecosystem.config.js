module.exports = {
  apps: [
    {
      name: 'service-car-simulator',
      script: 'server.js',
      cwd: '/var/www/service_car_simulator',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
