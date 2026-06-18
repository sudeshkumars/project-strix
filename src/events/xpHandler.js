'use strict'

const db                   = require('../../shared/db')
const { calcLevel }        = require('../../shared/utils')
const { safeSend }         = require('../../shared/utils')
const { success }          = require('../../shared/embed')

/**
 * Called from messageCreate after automod + prefix checks pass.
 * Grants XP, detects level-up, assigns level roles.
 */
async function handleXp (client, message, config) {
  if (!message.guild || message.author.bot) return

  const userId  = message.author.id
  const guildId = message.guild.id

  // ── Cooldown check ────────────────────────────────────────────────────────
  const cooldown = (config?.xp_cooldown ?? 60) * 1000
  const row      = db.getUser(userId, guildId)
  const lastXp   = row ? row.last_xp * 1000 : 0
  if (Date.now() - lastXp < cooldown) return

  // ── XP blacklist check ────────────────────────────────────────────────────
  const blacklist = parseObj(config?.xp_blacklist)
  const roles     = message.member?.roles?.cache?.map(r => r.id) ?? []

  if (blacklist.channels?.includes(message.channel.id)) return
  if (blacklist.roles?.some(r => roles.includes(r))) return

  // ── Calculate XP with multipliers ────────────────────────────────────────
  const base       = config?.xp_min ?? 15
  const max        = config?.xp_max ?? 25
  let   amount     = Math.floor(Math.random() * (max - base + 1)) + base

  const multipliers = db.getDb().prepare('SELECT * FROM xp_multipliers WHERE guild_id = ?').all(guildId)
  let   topMultiplier = 1.0
  for (const m of multipliers) {
    if (roles.includes(m.role_id) && m.multiplier > topMultiplier) {
      topMultiplier = m.multiplier
    }
  }
  amount = Math.floor(amount * topMultiplier)

  // ── Grant XP ──────────────────────────────────────────────────────────────
  const prevLevel  = row ? row.level : 0
  const updated    = db.addXp(userId, guildId, amount)
  const { level }  = calcLevel(updated.xp)

  if (level !== prevLevel) {
    db.setLevel(userId, guildId, level)
    await handleLevelUp(client, message, config, level)
  }
}

async function handleLevelUp (client, message, config, level) {
  const guild  = message.guild
  const user   = message.author
  const guildId = guild.id

  // ── Level-up message ──────────────────────────────────────────────────────
  const lvlChannel = config?.levelup_channel
    ? guild.channels.cache.get(config.levelup_channel)
    : message.channel

  const template = config?.levelup_message ?? 'GG {user}, you reached level {level}!'
  const content  = template
    .replace(/{user}/g,  user.toString())
    .replace(/{level}/g, String(level))
    .replace(/{server}/g, guild.name)

  if (lvlChannel) await safeSend(lvlChannel, { content })

  // ── Assign level roles ────────────────────────────────────────────────────
  const levelRoles = db.getLevelRoles(guildId)
  const earned     = levelRoles.filter(r => r.level <= level).map(r => r.role_id)

  const member = message.member
  if (!member || !earned.length) return

  for (const roleId of earned) {
    if (!member.roles.cache.has(roleId)) {
      try {
        await member.roles.add(roleId, `Level ${level} reward`)
      } catch {}
    }
  }
}

function parseObj (val) {
  if (!val) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}

module.exports = { handleXp }
