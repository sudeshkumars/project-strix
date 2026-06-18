'use strict'

const fs = require('fs')
if (fs.existsSync('../.env')) require('dotenv').config({ path: '../.env' })
if (fs.existsSync('.env')) require('dotenv').config()

const { REST, Routes } = require('discord.js')
const path = require('path')
const crypto = require('crypto')

const TOKEN     = process.env.BOT_TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const DEV_GUILD = process.env.DEV_GUILD_ID
const IS_DEV    = process.env.NODE_ENV === 'development'
const HASH_FILE = path.join(__dirname, '../data/cmd_hash.txt')

if (!TOKEN || !CLIENT_ID) {
  console.error('[deploy] BOT_TOKEN and CLIENT_ID are required.')
  process.exit(1)
}

// ─── Collect all command data ────────────────────────────────────────────────
function collectCommands () {
  const cmdsDir = path.join(__dirname, '../src/commands')
  const commands = []

  function walk (dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.js')) continue
      try {
        const mod = require(full)
        if (mod?.data?.toJSON) commands.push(mod.data.toJSON())
      } catch (e) {
        console.warn(`[deploy] Skipping ${entry.name}:`, e.message)
      }
    }
  }

  walk(cmdsDir)
  return commands
}

// ─── Hash commands ───────────────────────────────────────────────────────────
function hashCommands (commands) {
  const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name))
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex')
}

// ─── Deploy ──────────────────────────────────────────────────────────────────
async function deploy () {
  const commands = collectCommands()
  const hash     = hashCommands(commands)

  // Read stored hash
  let stored = null
  try { stored = fs.readFileSync(HASH_FILE, 'utf8').trim() } catch {}

  if (stored === hash) {
    console.log('[deploy] Commands unchanged — skipping deploy.')
    return
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN)

  try {
    const route = IS_DEV && DEV_GUILD
      ? Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD)
      : Routes.applicationCommands(CLIENT_ID)

    console.log(`[deploy] Deploying ${commands.length} commands (${IS_DEV ? 'guild' : 'global'})...`)
    await rest.put(route, { body: commands })

    // Save new hash
    fs.mkdirSync(path.dirname(HASH_FILE), { recursive: true })
    fs.writeFileSync(HASH_FILE, hash)

    console.log('[deploy] Done.')
  } catch (err) {
    console.error('[deploy] Deploy failed:', err)
    process.exit(1)
  }
}

deploy()
