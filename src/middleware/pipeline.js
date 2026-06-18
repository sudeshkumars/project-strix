'use strict'

const db                              = require('../../shared/db')
const { resolveTier, meetsRequirement, parseTier } = require('../../shared/permissions')
const { formatDuration }              = require('../../shared/utils')
const { error: errorEmbed }           = require('../../shared/embed')

const IS_SLASH  = i => typeof i.reply === 'function' && i.isChatInputCommand?.()
const IS_PREFIX = i => i.channel && !i.isChatInputCommand?.()

async function reject (ctx, msg) {
  const ephemeral = { ephemeral: true }
  const embed     = errorEmbed('Permission denied', msg)
  try {
    if (IS_SLASH(ctx)) {
      ctx.replied || ctx.deferred
        ? await ctx.followUp({ embeds: [embed], ...ephemeral })
        : await ctx.reply({ embeds: [embed], ...ephemeral })
    } else {
      const m = await ctx.reply({ embeds: [embed] })
      if (m?.deletable) setTimeout(() => m.delete().catch(() => {}), 8000)
    }
  } catch {}
  return true  // blocked
}

// ─── Middleware steps ─────────────────────────────────────────────────────────

async function blacklistCheck (client, ctx, command) {
  const userId  = ctx.user?.id ?? ctx.author?.id
  const guildId = ctx.guild?.id

  if (userId  && db.isUserBlacklisted(userId))   return reject(ctx, 'You are blacklisted from using this bot.')
  if (guildId && db.isGuildBlacklisted(guildId)) return reject(ctx, 'This server is blacklisted.')
  return false
}

async function guildOnlyCheck (client, ctx, command) {
  if (command.guildOnly && !ctx.guild) {
    return reject(ctx, 'This command can only be used in a server.')
  }
  return false
}

async function permCheck (client, ctx, command) {
  if (!command.permLevel || command.permLevel === 'user') return false
  if (!ctx.guild) return false

  const member   = ctx.member
  const config   = ctx.guildConfig ?? client.guildCache.get(ctx.guild.id)
  const required = parseTier(command.permLevel)
  const resolved = resolveTier(member, config)

  // Attach for use in command
  ctx.permLevel = resolved

  if (!meetsRequirement(resolved, required)) {
    return reject(ctx, `You need **${command.permLevel}** permission to use this command.`)
  }
  return false
}

async function cooldownCheck (client, ctx, command) {
  if (!command.cooldown) return false

  const userId = ctx.user?.id ?? ctx.author?.id
  const key    = `${userId}:${command.data?.name ?? command.name}`
  const now    = Date.now()

  if (client.cooldowns.has(key)) {
    const expires = client.cooldowns.get(key)
    if (now < expires) {
      const remaining = Math.ceil((expires - now) / 1000)
      return reject(ctx, `You're on cooldown. Try again in **${formatDuration(remaining)}**.`)
    }
  }

  client.cooldowns.set(key, now + command.cooldown * 1000)
  setTimeout(() => client.cooldowns.delete(key), command.cooldown * 1000)
  return false
}

async function injectConfig (client, ctx, command, extra) {
  if (ctx.guild) {
    const cfg = extra.config ?? client.guildCache.get(ctx.guild.id) ?? null
    ctx.guildConfig = cfg      // set on ctx (interaction object)
    if (extra && typeof extra === 'object') extra.config = cfg
  }
  return false
}

// ─── Pipeline runner ──────────────────────────────────────────────────────────

/**
 * Run all middleware. Returns true if the interaction is blocked.
 */
async function runMiddleware (client, ctx, command, extra = {}) {
  // Inject config first so subsequent steps can use it
  await injectConfig(client, ctx, command, extra)

  const steps = [
    blacklistCheck,
    guildOnlyCheck,
    permCheck,
    cooldownCheck
  ]

  for (const step of steps) {
    const blocked = await step(client, ctx, command)
    if (blocked) return true
  }

  return false
}

module.exports = { runMiddleware }
