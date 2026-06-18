'use strict'

module.exports = {
  apps: [{
    name: 'stryx',
    script: 'src/index.js',
    cwd: '/home/container/stryx',
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/stryx-error.log',
    out_file: 'logs/stryx-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 3000,
    max_restarts: 10
  }]
}
