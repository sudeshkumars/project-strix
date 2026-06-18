'use strict'

// ─── Environment ─────────────────────────────────────────────────────────────
const fs = require('fs')
if (fs.existsSync('.env')) require('dotenv').config()

const REQUIRED = ['BOT_TOKEN', 'CLIENT_ID', 'BOT_OWNER_ID']
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required env var: ${key}`)
    process.exit(1)
  }
}

// ─── Imports ──────────────────────────────────────────────────────────────────
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js')

const logger             = require('../shared/logger')
const db                 = require('../shared/db')

const commandHandler     = require('./handlers/commandHandler')
const eventHandler       = require('./handlers/eventHandler')
const interactionHandler = require('./handlers/interactionHandler')
const taskHandler        = require('./handlers/taskHandler')

// ─── DB init ──────────────────────────────────────────────────────────────────
try {
  db.init()
  logger.info('Database initialised')
} catch (e) {
  logger.error('Database init failed:', e)
  process.exit(1)
}

// ─── Client ───────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User
  ]
})

// ─── Maps ─────────────────────────────────────────────────────────────────────
client.commands   = new Collection()
client.aliases    = new Collection()
client.buttons    = new Collection()
client.modals     = new Collection()
client.menus      = new Collection()
client.cooldowns  = new Collection()
client.guildCache = new Map()
client.inviteCache = new Map()

// ─── Handlers ─────────────────────────────────────────────────────────────────
commandHandler(client)
eventHandler(client)
interactionHandler(client)
taskHandler(client)

// ─── Unhandled errors ─────────────────────────────────────────────────────────
process.on('unhandledRejection', err => logger.error('Unhandled rejection:', err))
process.on('uncaughtException',  err => { logger.error('Uncaught exception:', err); process.exit(1) })

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN).catch(e => {
  logger.error('Login failed:', e)
  process.exit(1)
})
