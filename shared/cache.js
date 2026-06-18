'use strict'

const db     = require('./db')
const logger = require('./logger')

// ─── JSON fields that need parsing on read ────────────────────────────────────
const JSON_FIELDS = [
  'mod_roles', 'admin_roles', 'welcome_autorole',
  'log_routes', 'log_ignore_roles', 'log_ignore_channels',
  'xp_blacklist', 'xp_multipliers', 'modules'
]

/**
 * Parse JSON fields in a guild_config row.
 * @param {object} row
 * @returns {object}
 */
function parseConfig (row) {
  if (!row) return null
  const out = { ...row }
  for (const field of JSON_FIELDS) {
    if (typeof out[field] === 'string') {
      try { out[field] = JSON.parse(out[field]) }
      catch { out[field] = field.includes('roles') || field.includes('list') ? [] : {} }
    }
  }
  return out
}

/**
 * Load all guild configs into client.guildCache on boot.
 * @param {import('discord.js').Client} client
 */
function loadAllConfigs (client) {
  const guilds = db.getAllGuilds()
  let loaded = 0

  for (const guild of guilds) {
    const config = db.getGuildConfig(guild.guild_id)
    if (config) {
      client.guildCache.set(guild.guild_id, parseConfig(config))
      loaded++
    }
  }

  logger.info(`Cache loaded — ${loaded} guild configs`)
}

/**
 * Reload a single guild's config into cache.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
function reloadGuild (client, guildId) {
  const config = db.getGuildConfig(guildId)
  if (config) {
    client.guildCache.set(guildId, parseConfig(config))
  } else {
    client.guildCache.delete(guildId)
  }
}

/**
 * Get a guild config from cache, fallback to DB if missing.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @returns {object|null}
 */
function getConfig (client, guildId) {
  if (client.guildCache.has(guildId)) return client.guildCache.get(guildId)
  const config = db.getGuildConfig(guildId)
  if (config) {
    const parsed = parseConfig(config)
    client.guildCache.set(guildId, parsed)
    return parsed
  }
  return null
}

/**
 * Update a field in cache + DB atomically.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {object} fields  — raw DB values (JSON-stringified where needed)
 * @param {object} [parsed] — parsed version for cache (optional, reloads from DB if omitted)
 */
function updateConfig (client, guildId, fields, parsed = null) {
  db.updateGuildConfig(guildId, fields)
  if (parsed) {
    const current = client.guildCache.get(guildId) ?? {}
    client.guildCache.set(guildId, { ...current, ...parsed })
  } else {
    reloadGuild(client, guildId)
  }
}

/**
 * Check if a module is enabled for a guild.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} moduleName
 * @returns {boolean}
 */
function isModuleEnabled (client, guildId, moduleName) {
  const config = getConfig(client, guildId)
  if (!config) return false
  const modules = config.modules ?? {}
  return modules[moduleName] === true || modules[moduleName] === 1
}

module.exports = { parseConfig, loadAllConfigs, reloadGuild, getConfig, updateConfig, isModuleEnabled }
