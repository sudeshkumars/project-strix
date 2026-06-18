'use strict'

const db     = require('../../../shared/db')
const logger = require('../../../shared/logger')
const { parseDuration, formatDuration, safeSend } = require('../../../shared/utils')
const { modDm } = require('../../../shared/embed')

// ─── Per-guild rate-limit buckets (in-memory) ─────────────────────────────────
// Map<guildId, Map<userId, Map<trigger, { count, resetAt }>>>
const buckets = new Map()

function getBucket (guildId, userId, trigger) {
  if (!buckets.has(guildId)) buckets.set(guildId, new Map())
  const g = buckets.get(guildId)
  if (!g.has(userId)) g.set(userId, new Map())
  const u = g.get(userId)
  if (!u.has(trigger)) u.set(trigger, { count: 0, resetAt: 0 })
  return u.get(trigger)
}

function incrementBucket (guildId, userId, trigger, windowSecs) {
  const b   = getBucket(guildId, userId, trigger)
  const now = Date.now()
  if (now > b.resetAt) {
    b.count   = 1
    b.resetAt = now + windowSecs * 1000
  } else {
    b.count++
  }
  return b.count
}

// ─── Trigger detectors ────────────────────────────────────────────────────────

const URL_RE     = /https?:\/\/\S+/gi
const INVITE_RE  = /discord(?:\.gg|\.com\/invite|app\.com\/invite)\/\S+/gi
const MENTION_RE = /<@[!&]?\d+>/g
const CAPS_RE    = /[A-Z]/g

function detectTrigger (rule, message) {
  const content = message.content

  switch (rule.trigger_type) {
    case 'spam': {
      const count = incrementBucket(message.guild.id, message.author.id, 'spam', rule.window_secs ?? 10)
      return count >= (rule.threshold ?? 5)
    }
    case 'mentions': {
      const mentions = (content.match(MENTION_RE) ?? []).length
      return mentions >= (rule.threshold ?? 5)
    }
    case 'links': {
      return URL_RE.test(content)
    }
    case 'invites': {
      return INVITE_RE.test(content)
    }
    case 'words': {
      const wordList = safeParseArray(rule.word_list)
      const lower    = content.toLowerCase()
      return wordList.some(w => lower.includes(w.toLowerCase()))
    }
    case 'regex': {
      const patterns = safeParseArray(rule.word_list)
      return patterns.some(p => { try { return new RegExp(p, 'i').test(content) } catch { return false } })
    }
    case 'caps': {
      if (content.length < 10) return false
      const capCount  = (content.match(CAPS_RE) ?? []).length
      const capRatio  = capCount / content.replace(/\s/g, '').length
      return capRatio >= ((rule.threshold ?? 70) / 100)
    }
    case 'newlines': {
      const lines = (content.match(/\n/g) ?? []).length
      return lines >= (rule.threshold ?? 10)
    }
    case 'emoji': {
      const emojiRe = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:[^:]+:\d+>)/gu
      const count   = (content.match(emojiRe) ?? []).length
      return count >= (rule.threshold ?? 10)
    }
    default:
      return false
  }
}

// ─── Action executor ──────────────────────────────────────────────────────────

async function executeAction (client, message, rule) {
  const { guild, author, channel } = message
  const config = client.guildCache.get(guild.id)

  let member
  try { member = await guild.members.fetch(author.id) } catch { return }

  // Delete the triggering message
  try { await message.delete() } catch {}

  const reason   = `[Automod] Rule #${rule.id} — ${rule.trigger_type}`
  const duration = rule.duration ? formatDuration(rule.duration) : null
  const expiresAt = rule.duration ? Math.floor(Date.now() / 1000) + rule.duration : null

  switch (rule.action) {
    case 'delete':
      // Already deleted above
      break

    case 'warn': {
      const caseId = db.createCase(guild.id, author.id, client.user.id, 'warn', reason)
      db.createWarning(guild.id, author.id, client.user.id, reason, 1, caseId)
      break
    }

    case 'mute': {
      const secs = rule.duration ?? 600  // default 10 min
      try {
        await member.timeout(secs * 1000, reason)
        const caseId = db.createCase(guild.id, author.id, client.user.id, 'mute', reason, expiresAt)
        db.createTempPunishment(guild.id, author.id, 'mute', expiresAt ?? (Math.floor(Date.now() / 1000) + secs), caseId)
      } catch {}
      break
    }

    case 'kick': {
      if (config?.dm_on_action) await safeSend(author, { embeds: [modDm({ action: 'Kick', guildName: guild.name, reason })] })
      try { await member.kick(reason) } catch {}
      db.createCase(guild.id, author.id, client.user.id, 'kick', reason)
      break
    }

    case 'ban': {
      if (config?.dm_on_action) await safeSend(author, { embeds: [modDm({ action: 'Ban', guildName: guild.name, reason, duration })] })
      try {
        await guild.members.ban(author.id, { reason })
        const caseId = db.createCase(guild.id, author.id, client.user.id, rule.duration ? 'tempban' : 'ban', reason, expiresAt)
        if (expiresAt) db.createTempPunishment(guild.id, author.id, 'ban', expiresAt, caseId)
      } catch {}
      break
    }
  }

  // ── Log to mod channel ───────────────────────────────────────────────────
  const modChannel = config?.mod_channel ? guild.channels.cache.get(config.mod_channel) : null
  if (modChannel) {
    await safeSend(modChannel, {
      content: [
        `🛡️ **Automod triggered** | Rule #${rule.id} (\`${rule.trigger_type}\` → \`${rule.action}\`)`,
        `**User:** <@${author.id}> (\`${author.tag}\`)`,
        `**Channel:** <#${channel.id}>`,
        duration ? `**Duration:** ${duration}` : null
      ].filter(Boolean).join('\n')
    })
  }

  logger.debug(`Automod rule #${rule.id} fired on ${author.tag} in ${guild.name}`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

// ─── Main engine entry ────────────────────────────────────────────────────────

module.exports = {
  async execute (client, message, config) {
    if (!message.guild || message.author.bot) return
    if (!message.content) return

    const rules = db.getAutomodRules(message.guild.id)
    if (!rules.length) return

    const memberRoles = message.member?.roles?.cache?.map(r => r.id) ?? []
    const channelId   = message.channel.id

    for (const rule of rules) {
      const ignoreRoles    = safeParseArray(rule.ignore_roles)
      const ignoreChannels = safeParseArray(rule.ignore_channels)
      if (ignoreRoles.some(r => memberRoles.includes(r))) continue
      if (ignoreChannels.includes(channelId)) continue
      if (detectTrigger(rule, message)) {
        await executeAction(client, message, rule)
        break
      }
    }
  },
  detectTrigger
}
