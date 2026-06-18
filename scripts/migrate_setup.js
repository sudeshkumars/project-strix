// Migration: add new welcome columns for setup system
// Run: node scripts/migrate_setup.js
// Safe to run multiple times.

'use strict'

const Database = require('better-sqlite3')
const path     = require('path')

const DB_PATH = path.join(__dirname, '../data/stryx.db')
const db      = new Database(DB_PATH)

const columns = [
  { col: 'welcome_avatar_src',  def: `TEXT DEFAULT 'user'`    },
  { col: 'welcome_bg_source',   def: `TEXT DEFAULT 'default'` },
  { col: 'birthday_channel',    def: `TEXT`                   },
  { col: 'birthday_role',       def: `TEXT`                   },
]

for (const { col, def } of columns) {
  try {
    db.exec(`ALTER TABLE guild_config ADD COLUMN ${col} ${def}`)
    console.log(`Added column: ${col}`)
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log(`Already exists: ${col}`)
    } else {
      console.error(`Failed to add ${col}:`, e.message)
    }
  }
}

console.log('Migration complete.')
db.close()
