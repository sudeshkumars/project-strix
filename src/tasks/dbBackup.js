'use strict'

const path = require('path')
const fs   = require('fs')

const DB_PATH      = path.join(__dirname, '../../data/stryx.db')
const BACKUP_DIR   = path.join(__dirname, '../../data/backups')
const KEEP_DAYS    = 7

module.exports = {
  name:     'dbBackup',
  interval: '0 3 * * *',   // 3am UTC daily

  async execute (client) {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })

      const date     = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
      const destPath = path.join(BACKUP_DIR, `stryx_${date}.db`)

      // better-sqlite3 backup API — non-blocking, safe on live DB
      const db = require('../../shared/db').getDb()
      await db.backup(destPath)

      // ── Rolling cleanup: remove backups older than KEEP_DAYS ─────────────
      const cutoff = Date.now() - KEEP_DAYS * 86400 * 1000
      const files  = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('stryx_') && f.endsWith('.db'))

      let removed = 0
      for (const file of files) {
        const filePath = path.join(BACKUP_DIR, file)
        const stat     = fs.statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath)
          removed++
        }
      }

      const sizeMb = (fs.statSync(destPath).size / 1024 / 1024).toFixed(2)
      console.log(`[dbBackup] Backup saved → ${destPath} (${sizeMb} MB)${removed ? ` | ${removed} old backup(s) removed` : ''}`)
    } catch (e) {
      console.error('[dbBackup] Backup failed:', e.message)
    }
  }
}
