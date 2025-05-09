module.exports = {
  apps: [
    {
      name: 'moxakk-server',
      script: 'dist/index.js',
      instances: 'max', // Use max for auto-detection based on available CPUs
      exec_mode: 'cluster', // Run in cluster mode for load balancing
      autorestart: true, // Auto restart if app crashes
      watch: false, // Don't watch for file changes in production
      max_memory_restart: '4G', // Restart if memory usage exceeds 1GB
      env: {
        NODE_ENV: 'production',
        // You can add other environment variables here
        AI_CONCURRENCY: '3', // Limit concurrent AI requests
        CACHE_TTL: '3600' // Cache TTL in seconds (1 hour)
      },
      env_development: {
        NODE_ENV: 'development',
        AI_CONCURRENCY: '2', // Lower concurrency for development
        CACHE_TTL: '300' // Shorter cache TTL for development (5 minutes)
      }
    }
  ]
};