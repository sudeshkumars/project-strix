'use strict'

const db                   = require('../../shared/db')
const { getConfig }        = require('../../shared/cache')
const { safeSend, resolveWelcomeVars } = require('../../shared/utils')
const { sendLog }          = require('../../shared/logRouter')
const { EmbedBuilder }     = require('discord.js')
const { COLORS }           = require('../../shared/embed')

module.exports = {
  name: 'guildMemberAdd',
  async execute (client, member) {
    const guildId = member.guild.id
    const config  = getConfig(client, guildId)

    db.upsertUser(member.id, guildId)
    db.incrementActivityStat(guildId, 'joins')

    // ── Autoroles ─────────────────────────────────────────────────────────────
    const autoroles = safeParseArray(config?.welcome_autorole)
    for (const roleId of autoroles) {
      try { await member.roles.add(roleId, 'Autorole on join') } catch {}
    }

    // ── Welcome message ───────────────────────────────────────────────────────
    if (config?.welcome_channel) {
      const channel = member.guild.channels.cache.get(config.welcome_channel)
      if (channel) {
        const text = resolveWelcomeVars(
          config.welcome_message ?? 'Welcome {user} to {server}!',
          member
        )

        if (config.welcome_style === 'embed') {
          const color = config.welcome_color
            ? parseInt(config.welcome_color.replace('#', ''), 16)
            : COLORS.info
          const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setTimestamp()
          await safeSend(channel, { embeds: [embed] })
        } else {
          await safeSend(channel, { content: text })
        }
      }
    }

    // ── Join log ──────────────────────────────────────────────────────────────
    const joinEmbed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle('Member Joined')
      .addFields(
        { name: 'User',         value: `${member.user.username} (\`${member.id}\`)`, inline: true },
        { name: 'Account Age',  value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Member Count', value: String(member.guild.memberCount), inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
      .setTimestamp()
    await sendLog(client, guildId, 'member_join', { embeds: [joinEmbed] })

    // ── DM ────────────────────────────────────────────────────────────────────
    if (config?.welcome_dm) {
      const dmMsg = resolveWelcomeVars(
        config.welcome_dm_message ?? `Welcome to **${member.guild.name}**!`,
        member
      )
      await safeSend(member.user, { content: dmMsg })
    }
  }
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
