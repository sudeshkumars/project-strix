'use strict'

const { runMiddleware }  = require('../middleware/pipeline')
const { getConfig }      = require('../../shared/cache')
const logger             = require('../../shared/logger')
const { handleXp }          = require('./xpHandler')
const { checkHighlights }   = require('./highlightWatcher')
const db                    = require('../../shared/db')
const automodEvent          = require('./automod/automodEngine')
const { EmbedBuilder }      = require('discord.js')
const { COLORS }            = require('../../shared/embed')

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute (client, message) {
    if (message.author.bot) return
    if (!message.guild) return

    const config = getConfig(client, message.guild.id)
    const prefix = config?.prefix ?? '!'

    // ── Automod (runs regardless of prefix) ──────────────────────────────────
    await automodEvent.execute(client, message, config).catch(() => {})

    // ── AFK system ────────────────────────────────────────────────────────────
    handleAfk(client, message).catch(() => {})

    // ── XP grant ──────────────────────────────────────────────────────────────
    await handleXp(client, message, config).catch(() => {})

    // ── Activity stat ──────────────────────────────────────────────────────────
    try { db.incrementActivityStat(message.guild.id, 'messages') } catch {}

    // ── Highlights ────────────────────────────────────────────────────────────
    await checkHighlights(client, message).catch(() => {})

    // ── Auto-responses ────────────────────────────────────────────────────────
    checkAutoResponses(client, message, message.guild.id).catch(() => {})

    // ── Sticky messages ───────────────────────────────────────────────────────
    handleSticky(client, message).catch(() => {})

    // ── Prefix command check ──────────────────────────────────────────────────
    if (!message.content.startsWith(prefix)) return

    const args    = message.content.slice(prefix.length).trim().split(/\s+/)
    const cmdName = args.shift().toLowerCase()
    if (!cmdName) return

    // Resolve command or alias
    const name    = client.aliases.get(cmdName) ?? cmdName
    const command = client.commands.get(name)
    if (!command) return
    if (command.prefix === false) return   // slash-only command
    if (command.guildOnly && !message.guild) return

    // Run middleware
    const blocked = await runMiddleware(client, message, command, { type: 'prefix', config })
    message.guildConfig = config  // ensure commands can read it
    if (blocked) return

    try {
      await command.execute(client, message, args)
      logger.command(name, message.author.id, message.guild.id)
    } catch (e) {
      logger.error(`Prefix cmd ${name} error:`, e)
      message.reply({ content: '\u274c An error occurred running that command.' }).catch(() => {})
    }
  }
}

// ─── AFK handler ──────────────────────────────────────────────────────────────
async function handleAfk (client, message) {
  const guildId = message.guild.id
  const userId  = message.author.id

  // Check if the author is AFK - remove their AFK
  const authorAfk = db.getAfk(userId, guildId)
  if (authorAfk) {
    db.removeAfk(userId, guildId)
    message.reply({ content: 'Welcome back! Your AFK has been removed.' }).catch(() => {})
  }

  // Check if any mentioned users are AFK
  if (message.mentions.users.size > 0) {
    for (const [mentionedId] of message.mentions.users) {
      const afk = db.getAfk(mentionedId, guildId)
      if (afk) {
        message.reply({
          content: `<@${mentionedId}> is AFK: ${afk.reason} (since <t:${afk.set_at}:R>)`,
          allowedMentions: { parse: [] }
        }).catch(() => {})
        break // Only notify for first AFK mention to avoid spam
      }
    }
  }
}

// ─── Sticky message handler ──────────────────────────────────────────────────
async function handleSticky (client, message) {
  const guildId   = message.guild.id
  const channelId = message.channel.id

  const sticky = db.getSticky(guildId, channelId)
  if (!sticky) return

  db.incrementStickyCounter(guildId, channelId)

  // Re-fetch to get updated counter
  const updated = db.getSticky(guildId, channelId)
  if (!updated || updated.counter < updated.threshold) return

  // Delete old sticky message
  if (updated.message_id) {
    try {
      const oldMsg = await message.channel.messages.fetch(updated.message_id).catch(() => null)
      if (oldMsg) await oldMsg.delete().catch(() => {})
    } catch {}
  }

  // Re-send the sticky
  let newMsg
  if (updated.embed) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setDescription(updated.content || 'Sticky message')
      .setFooter({ text: '\ud83d\udccc Sticky Message' })
    newMsg = await message.channel.send({ embeds: [embed] }).catch(() => null)
  } else {
    newMsg = await message.channel.send({ content: `\ud83d\udccc ${updated.content}` }).catch(() => null)
  }

  // Reset counter and update message_id
  db.resetStickyCounter(guildId, channelId)
  if (newMsg) {
    db.updateSticky(guildId, channelId, { message_id: newMsg.id })
  }
}

// ─── Auto-response engine ─────────────────────────────────────────────────────
async function checkAutoResponses (client, message, guildId) {
  const rows = db.getDb().prepare(`
    SELECT * FROM custom_commands
    WHERE guild_id = ? AND type = 'autoresponse'
  `).all(guildId)
  if (!rows.length) return

  const content = message.content
  if (!content) return

  for (const row of rows) {
    const scope = safeParseArr(row.channel_scope)
    if (scope.length && !scope.includes(message.channel.id)) continue

    const matched = row.regex
      ? (() => { try { return new RegExp(row.trigger, 'i').test(content) } catch { return false } })()
      : row.perm_level === 'exact'
        ? content.toLowerCase() === row.trigger.toLowerCase()
        : content.toLowerCase().includes(row.trigger.toLowerCase())

    if (matched) {
      await message.channel.send({ content: row.response }).catch(() => {})
      db.incrementTagUses(row.id)
      break
    }
  }
}

function safeParseArr (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
