'use strict'

const { EmbedBuilder } = require('discord.js')

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = {
  success:     0x57F287,
  error:       0xED4245,
  warn:        0xFEE75C,
  info:        0x5865F2,
  mod:         0xEB459E,
  level:       0xF4A460,
  log:         0x99AAB5,
  update:      0x5865F2,
  maintenance: 0xFEE75C,
  alert:       0xED4245
}

// ─── Global footer ────────────────────────────────────────────────────────────
// Configure these in your .env (or Pterodactyl panel Startup tab):
//
//   FOOTER_TEXT       Display name shown in every embed footer.
//                     Defaults to "Stryx" if unset.
//
//   SUPPORT_SERVER    Your Discord invite link.
//                     Appended to FOOTER_TEXT as "Stryx • https://discord.gg/…"
//                     Leave unset until you have a link.
//
//   FOOTER_ICON       Direct image URL for the small footer icon (your bot avatar
//                     or a logo URL). Leave unset until you have one.

function buildFooterText () {
  const base    = process.env.FOOTER_TEXT    || 'Stryx'
  const support = process.env.SUPPORT_SERVER || ''
  return support ? `${base} • ${support}` : base
}

/**
 * Applies the global footer (text + optional icon) to any EmbedBuilder and
 * returns it so calls can be chained.
 *
 * Export this so one-off embeds built outside this file (e.g. paginated lists,
 * canvas rank cards) can also call withFooter(e) for consistency.
 *
 * @param {EmbedBuilder} embed
 * @returns {EmbedBuilder}
 */
function withFooter (embed) {
  const text    = buildFooterText()
  const iconUrl = process.env.FOOTER_ICON || null

  embed.setFooter(iconUrl ? { text, iconURL: iconUrl } : { text })
  return embed
}

// ─── Base builders ────────────────────────────────────────────────────────────

function success (title, description) {
  const e = new EmbedBuilder().setColor(COLORS.success).setTitle(`✅ ${title}`)
  if (description) e.setDescription(description)
  return withFooter(e)
}

function error (title, description) {
  const e = new EmbedBuilder().setColor(COLORS.error).setTitle(`❌ ${title}`)
  if (description) e.setDescription(description)
  return withFooter(e)
}

function warn (title, description) {
  const e = new EmbedBuilder().setColor(COLORS.warn).setTitle(`⚠️ ${title}`)
  if (description) e.setDescription(description)
  return withFooter(e)
}

function info (title, description) {
  const e = new EmbedBuilder().setColor(COLORS.info).setTitle(title)
  if (description) e.setDescription(description)
  return withFooter(e)
}

// ─── Mod action embed ─────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}  opts.action    'Ban' | 'Kick' | 'Mute' | 'Warn' | 'Unban' | 'Unmute' | 'Softban' | 'Note'
 * @param {import('discord.js').User} opts.target
 * @param {import('discord.js').User} opts.mod
 * @param {string}  opts.reason
 * @param {number}  opts.caseId
 * @param {string}  [opts.duration]
 * @param {number}  [opts.warnCount]
 */
function modAction (opts) {
  const { action, target, mod, reason, caseId, duration, warnCount } = opts

  const e = new EmbedBuilder()
    .setColor(COLORS.mod)
    .setTitle(`🔨 ${action} — Case #${caseId}`)
    .addFields(
      { name: 'User',   value: `${target.tag} (\`${target.id}\`)`, inline: true },
      { name: 'Mod',    value: `${mod.tag} (\`${mod.id}\`)`,       inline: true },
      { name: 'Reason', value: reason || 'No reason provided',      inline: false }
    )
    .setThumbnail(target.displayAvatarURL({ size: 64 }))
    .setTimestamp()

  if (duration)          e.addFields({ name: 'Duration',          value: duration,          inline: true })
  if (warnCount != null) e.addFields({ name: 'Total Warn Points', value: String(warnCount), inline: true })

  return withFooter(e)
}

/**
 * DM embed sent to the punished user.
 * @param {object} opts
 * @param {string} opts.action
 * @param {string} opts.guildName
 * @param {string} opts.reason
 * @param {string} [opts.duration]
 * @param {string} [opts.appealChannel]
 */
function modDm (opts) {
  const { action, guildName, reason, duration, appealChannel } = opts

  const e = new EmbedBuilder()
    .setColor(COLORS.mod)
    .setTitle(`You were ${action.toLowerCase()}ed in **${guildName}**`)
    .addFields({ name: 'Reason', value: reason || 'No reason provided' })
    .setTimestamp()

  if (duration)      e.addFields({ name: 'Duration',       value: duration })
  if (appealChannel) e.addFields({ name: 'Appeal channel', value: appealChannel })

  return withFooter(e)
}

module.exports = { COLORS, withFooter, success, error, warn, info, modAction, modDm }
