'use strict'

// Full migration logic implemented in Part 2 (shared/db.js)
// This script is a runner that calls db.init() directly

const fs = require('fs')
if (fs.existsSync('.env')) require('dotenv').config()

const db = require('../shared/db')

try {
  db.init()
  console.log('[migrate] Database initialised successfully.')
  process.exit(0)
} catch (err) {
  console.error('[migrate] Failed:', err)
  process.exit(1)
}
