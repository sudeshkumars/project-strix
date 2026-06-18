'use strict'

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js')

// ─── Session store ────────────────────────────────────────────────────────────
// Map<`${userId}:${guildId}:${module}`, { pending, expiresAt, messageId }>
const sessions = new Map()
const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes

function sessionKey (userId, guildId, module) {
  return `${userId}:${guildId}:${module}`
}

function getSession (userId, guildId, module) {
  const key = sessionKey(userId, guildId, module)
  const s   = sessions.get(key)
  if (!s) return null
  if (Date.now() > s.expiresAt) { sessions.delete(key); return null }
  return s
}

function setSession (userId, guildId, module, data) {
  const key = sessionKey(userId, guildId, module)
  sessions.set(key, {
    ...data,
    expiresAt: Date.now() + SESSION_TTL_MS
  })
}

function clearSession (userId, guildId, module) {
  sessions.delete(sessionKey(userId, guildId, module))
}

function touchSession (userId, guildId, module) {
  const s = getSession(userId, guildId, module)
  if (s) setSession(userId, guildId, module, s)
}

// Purge expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(key)
  }
}, 5 * 60 * 1000)

// ─── Branding embed builder ───────────────────────────────────────────────────
const COLORS = {
  default: 0x5865F2,
  pending: 0xF0B132,
  saved:   0x57F287,
  error:   0xED4245
}

/**
 * Build a branded setup embed.
 * @param {import('discord.js').Guild} guild
 * @param {object} opts
 * @param {string}   opts.title
 * @param {string}   opts.description
 * @param {Array}    opts.fields        — [{ name, value, inline }]
 * @param {'default'|'pending'|'saved'|'error'} [opts.state]
 */
function buildSetupEmbed (guild, { title, description, fields = [], state = 'default' }) {
  const bannerUrl  = process.env.SETUP_BANNER_URL  || null
  const footerText = process.env.SETUP_FOOTER_TEXT || process.env.FOOTER_TEXT || 'Stryx'
  const footerIcon = process.env.FOOTER_ICON       || null

  const embed = new EmbedBuilder()
    .setColor(COLORS[state])
    .setTitle(title)
    .setDescription(description)
    .setAuthor({
      name:    guild.name,
      iconURL: guild.iconURL({ size: 64 }) ?? undefined
    })
    .setTimestamp()

  if (fields.length) embed.addFields(fields)
  if (bannerUrl)     embed.setImage(bannerUrl)

  embed.setFooter(footerIcon
    ? { text: footerText, iconURL: footerIcon }
    : { text: footerText }
  )

  return embed
}

/**
 * Display value helper — turns null/undefined/empty into "Not set".
 */
function display (val, prefix = '') {
  if (val === null || val === undefined || val === '' || val === '[]' || val === '{}') return 'Not set'
  if (Array.isArray(val)) return val.length ? val.join(', ') : 'None'
  return prefix ? `${prefix}${val}` : String(val)
}

function displayChannel (id)    { return id  ? `<#${id}>`  : 'Not set' }
function displayRole    (id)    { return id  ? `<@&${id}>` : 'Not set' }
function displayBool    (val)   { return val ? 'Enabled'   : 'Disabled' }

/**
 * Build a standard button row.
 * Each item: { id, label, style? }
 * Max 5 per row, auto-splits into multiple rows (Discord max 5 rows).
 */
function buildRows (buttons) {
  const rows = []
  for (let i = 0; i < buttons.length; i += 5) {
    const chunk = buttons.slice(i, i + 5)
    const row   = new ActionRowBuilder()
    for (const btn of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(btn.id)
          .setLabel(btn.label)
          .setStyle(btn.style ?? ButtonStyle.Primary)
          .setDisabled(btn.disabled ?? false)
      )
    }
    rows.push(row)
  }
  return rows
}

/**
 * Guard: reject button presses from users who don't own the session.
 * Returns true if blocked (caller should return early).
 */
async function guardSession (interaction, module) {
  const userId  = interaction.user.id
  const guildId = interaction.guild.id
  const session = getSession(userId, guildId, module)

  if (!session) {
    await interaction.reply({
      content: 'This setup session has expired. Run the setup command again.',
      flags: MessageFlags.Ephemeral
    })
    return true
  }

  // Ensure only the owner of this session can press buttons
  const [ownerId] = interaction.customId.split(':').slice(-2)
  if (ownerId && ownerId !== userId) {
    await interaction.reply({
      content: 'This setup panel belongs to another user.',
      flags: MessageFlags.Ephemeral
    })
    return true
  }

  touchSession(userId, guildId, module)
  return false
}

module.exports = {
  getSession, setSession, clearSession, touchSession,
  buildSetupEmbed, buildRows,
  display, displayChannel, displayRole, displayBool,
  guardSession, COLORS
}
