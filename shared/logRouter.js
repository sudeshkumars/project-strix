'use strict'

/**
 * Resolve the correct log channel for an event type.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} eventType  — one of the EVENT_TYPES from logs.js
 * @param {object} [opts]
 * @param {string} [opts.channelId]  — channel the event occurred in (for ignore check)
 * @param {string[]} [opts.roleIds]  — roles of the acting member (for ignore check)
 * @returns {import('discord.js').TextChannel|null}
 */
function resolveLogChannel (client, guildId, eventType, opts = {}) {
  const config = client.guildCache?.get(guildId)
  if (!config) return null

  // Ignore checks
  const ignoreChs   = safeArr(config.log_ignore_channels)
  const ignoreRoles = safeArr(config.log_ignore_roles)

  if (opts.channelId && ignoreChs.includes(opts.channelId)) return null
  if (opts.roleIds?.some(r => ignoreRoles.includes(r))) return null

  // Route resolution: specific route → fallback log_channel → null
  const routes    = parseObj(config.log_routes)
  const channelId = routes[eventType] ?? config.log_channel ?? null
  if (!channelId) return null

  const guild = client.guilds.cache.get(guildId)
  return guild?.channels.cache.get(channelId) ?? null
}

/**
 * Send a log embed to the correct channel for an event type.
 * Returns silently if no channel is configured or message fails.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} eventType
 * @param {object} payload   — { embeds, content, files }
 * @param {object} [opts]    — passed to resolveLogChannel
 */
async function sendLog (client, guildId, eventType, payload, opts = {}) {
  const channel = resolveLogChannel(client, guildId, eventType, opts)
  if (!channel) return
  try { await channel.send(payload) } catch {}
}

function parseObj (val) {
  if (!val) return {}
  if (typeof val === 'object' && !Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return {} }
}

function safeArr (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

module.exports = { resolveLogChannel, sendLog }
