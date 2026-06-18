'use strict'

// ─── Time ─────────────────────────────────────────────────────────────────────

/**
 * Parse a duration string like "10m", "2h", "7d" into seconds.
 * Returns null if invalid.
 * @param {string} str
 * @returns {number|null}
 */
function parseDuration (str) {
  if (!str) return null
  const match = str.trim().match(/^(\d+)(s|m|h|d|w)$/i)
  if (!match) return null
  const n = parseInt(match[1])
  const unit = match[2].toLowerCase()
  const map = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }
  return n * map[unit]
}

/**
 * Format seconds into a human-readable string.
 * @param {number} secs
 * @returns {string}  e.g. "2h 30m"
 */
function formatDuration (secs) {
  if (!secs || secs < 0) return '0s'
  const w = Math.floor(secs / 604800)
  const d = Math.floor((secs % 604800) / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return [
    w && `${w}w`, d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`
  ].filter(Boolean).join(' ') || '0s'
}

/**
 * Unix timestamp (seconds) → Discord relative time string.
 * @param {number} unix
 * @returns {string}  e.g. "<t:1234567890:R>"
 */
function relativeTime (unix) {
  return `<t:${Math.floor(unix)}:R>`
}

/**
 * Unix timestamp → Discord full datetime.
 * @param {number} unix
 * @returns {string}
 */
function fullTime (unix) {
  return `<t:${Math.floor(unix)}:F>`
}

// ─── XP / Level ──────────────────────────────────────────────────────────────

/**
 * Calculate XP required to reach a given level.
 * Formula: 5 * level^2 + 50 * level + 100
 * @param {number} level
 * @returns {number}
 */
function xpForLevel (level) {
  return 5 * level * level + 50 * level + 100
}

/**
 * Calculate total XP needed to reach a level from level 0.
 * @param {number} level
 * @returns {number}
 */
function totalXpForLevel (level) {
  let total = 0
  for (let i = 0; i < level; i++) total += xpForLevel(i)
  return total
}

/**
 * Given a total XP amount, return current level and XP progress within that level.
 * @param {number} totalXp
 * @returns {{ level: number, currentXp: number, neededXp: number }}
 */
function calcLevel (totalXp) {
  let level = 0
  let remaining = totalXp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return { level, currentXp: remaining, neededXp: xpForLevel(level) }
}

// ─── Welcome variables ────────────────────────────────────────────────────────

/**
 * Replace template variables in welcome/goodbye messages.
 * @param {string} template
 * @param {import('discord.js').GuildMember} member
 * @returns {string}
 */
function resolveWelcomeVars (template, member) {
  if (!template) return ''
  const guild       = member.guild
  const joinedAt    = member.user.createdAt
  const accountAge  = Math.floor((Date.now() - joinedAt.getTime()) / 86400000)
  const joinPos     = guild.memberCount

  return template
    .replace(/{user}/g,         member.toString())
    .replace(/{username}/g,     member.user.username)
    .replace(/{server}/g,       guild.name)
    .replace(/{member_count}/g, String(guild.memberCount))
    .replace(/{join_position}/g,String(joinPos))
    .replace(/{account_age}/g,  `${accountAge} days`)
    .replace(/{date}/g,         new Date().toLocaleDateString('en-US'))
}

// ─── String helpers ───────────────────────────────────────────────────────────

/**
 * Truncate a string to a max length, appending '...' if needed.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate (str, max = 1024) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 3) + '...' : str
}

/**
 * Escape Discord markdown characters.
 * @param {string} str
 * @returns {string}
 */
function escapeMarkdown (str) {
  return str.replace(/([*_`~\\|])/g, '\\$1')
}

/**
 * Capitalise the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalise (str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Split a large string into chunks of max `size` characters.
 * @param {string} str
 * @param {number} size
 * @returns {string[]}
 */
function chunkString (str, size = 1900) {
  const chunks = []
  let i = 0
  while (i < str.length) {
    chunks.push(str.slice(i, i + size))
    i += size
  }
  return chunks
}

// ─── Discord helpers ──────────────────────────────────────────────────────────

/**
 * Resolve a user from a mention string or ID.
 * @param {string} mention
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').GuildMember|null>}
 */
async function resolveMember (mention, guild) {
  if (!mention) return null
  const id = mention.replace(/[<@!>]/g, '')
  try {
    return await guild.members.fetch(id)
  } catch {
    return null
  }
}

/**
 * Check if the bot has a permission in a channel.
 * @param {import('discord.js').GuildChannel} channel
 * @param {bigint} permission
 * @returns {boolean}
 */
function botHasPerm (channel, permission) {
  return channel.permissionsFor(channel.guild.members.me)?.has(permission) ?? false
}

/**
 * Safe send — catches missing permissions / closed DMs silently.
 * @param {import('discord.js').TextChannel|import('discord.js').User} target
 * @param {object} payload
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function safeSend (target, payload) {
  try {
    return await target.send(payload)
  } catch {
    return null
  }
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Sleep for N milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Safely parse a JSON string. Returns fallback on failure.
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
function safeJson (str, fallback = null) {
  try { return JSON.parse(str) }
  catch { return fallback }
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd…).
 * @param {number} n
 * @returns {string}
 */
function ordinal (n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

module.exports = {
  // time
  parseDuration, formatDuration, relativeTime, fullTime,
  // xp
  xpForLevel, totalXpForLevel, calcLevel,
  // welcome
  resolveWelcomeVars,
  // string
  truncate, escapeMarkdown, capitalise, chunkString,
  // discord
  resolveMember, botHasPerm, safeSend,
  // misc
  sleep, safeJson, ordinal
}
