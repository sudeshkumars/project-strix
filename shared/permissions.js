'use strict'

const { PermissionFlagsBits } = require('discord.js')

// ─── Tier constants ───────────────────────────────────────────────────────────
const TIERS = {
  USER:  0,
  MOD:   1,
  ADMIN: 2,
  OWNER: 3
}

/**
 * Resolve the permission tier for a member in a guild.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {object} guildConfig  — row from guild_config (parsed JSON fields)
 * @returns {number}  TIERS.USER | MOD | ADMIN | OWNER
 */
function resolveTier (member, guildConfig) {
  // Bot owner — hardcoded, always highest
  if (member.id === process.env.BOT_OWNER_ID) return TIERS.OWNER

  const roleIds = member.roles.cache.map(r => r.id)

  // Guild owner
  if (member.guild.ownerId === member.id) return TIERS.ADMIN

  // Admin: ADMINISTRATOR permission OR in admin_roles list
  const adminRoles = safeParseArray(guildConfig?.admin_roles)
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    adminRoles.some(r => roleIds.includes(r))
  ) return TIERS.ADMIN

  // Mod: MANAGE_MESSAGES + KICK_MEMBERS permission OR in mod_roles list
  const modRoles = safeParseArray(guildConfig?.mod_roles)
  if (
    (
      member.permissions.has(PermissionFlagsBits.ManageMessages) &&
      member.permissions.has(PermissionFlagsBits.KickMembers)
    ) ||
    modRoles.some(r => roleIds.includes(r))
  ) return TIERS.MOD

  return TIERS.USER
}

/**
 * Check if a resolved tier meets the required tier.
 * @param {number} resolved
 * @param {number} required
 * @returns {boolean}
 */
function meetsRequirement (resolved, required) {
  return resolved >= required
}

/**
 * Get human-readable tier name.
 * @param {number} tier
 * @returns {string}
 */
function tierName (tier) {
  return Object.keys(TIERS).find(k => TIERS[k] === tier) ?? 'USER'
}

/**
 * Parse a tier string to number. Accepts 'user'|'mod'|'admin'|'owner'.
 * @param {string} str
 * @returns {number}
 */
function parseTier (str) {
  return TIERS[str?.toUpperCase()] ?? TIERS.USER
}

// ─── Internal helper ──────────────────────────────────────────────────────────
function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

module.exports = { TIERS, resolveTier, meetsRequirement, tierName, parseTier }
