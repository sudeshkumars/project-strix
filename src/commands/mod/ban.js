'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                    = require('../../../shared/db')
const logger                = require('../../../shared/logger')
const { modCard, errorCard } = require('../../../shared/components')
const { modDm }             = require('../../../shared/embed')
const { parseDuration, formatDuration, safeSend } = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .addStringOption(o => o.setName('duration').setDescription('Temp-ban duration e.g. 7d').setRequired(false))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target     = interaction.options.getUser('user')
    const reason     = interaction.options.getString('reason') ?? 'No reason provided'
    const durStr     = interaction.options.getString('duration')
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0
    const config     = interaction.guildConfig
    const guild      = interaction.guild

    // ── Target validation ────────────────────────────────────────────────────
    let member
    try { member = await guild.members.fetch(target.id) } catch {}

    if (member) {
      if (!member.bannable) {
        return interaction.editReply(errorCard('Cannot Ban', ['I cannot ban that member (role hierarchy).']))
      }
      if (member.id === interaction.user.id) {
        return interaction.editReply(errorCard('Invalid', ['You cannot ban yourself.']))
      }
    }

    // ── Parse duration ───────────────────────────────────────────────────────
    let expiresAt = null
    let durLabel  = null
    if (durStr) {
      const secs = parseDuration(durStr)
      if (!secs) return interaction.editReply(errorCard('Invalid Duration', ['Use e.g. `7d`, `24h`.']))
      expiresAt = Math.floor(Date.now() / 1000) + secs
      durLabel  = formatDuration(secs)
    }

    // ── DM user before ban ───────────────────────────────────────────────────
    if (config?.dm_on_action && member) {
      await safeSend(target, {
        embeds: [modDm({
          action: durLabel ? 'Temp-Ban' : 'Ban',
          guildName: guild.name,
          reason,
          duration: durLabel,
          appealChannel: config.appeal_channel ? `<#${config.appeal_channel}>` : null
        })]
      })
    }

    // ── Execute ban ──────────────────────────────────────────────────────────
    try {
      await guild.members.ban(target.id, {
        reason: `[Stryx] ${reason} | Mod: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400
      })
    } catch (e) {
      return interaction.editReply(errorCard('Ban Failed', [`${e.message}`]))
    }

    // ── Create case ──────────────────────────────────────────────────────────
    const caseId = db.createCase(guild.id, target.id, interaction.user.id,
      durLabel ? 'tempban' : 'ban', reason, expiresAt)

    if (expiresAt) {
      db.createTempPunishment(guild.id, target.id, 'ban', expiresAt, caseId)
    }

    // ── Log to case channel ──────────────────────────────────────────────────
    const action = durLabel ? 'Temp Ban' : 'Ban'
    const lines = [
      `**User** \u2014 ${target.username} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.username} (\`${interaction.user.id}\`)`,
      `**Reason** \u2014 ${reason}`
    ]
    if (durLabel) lines.push(`**Duration** \u2014 ${durLabel}`)

    const payload = modCard(`\u{1f528} ${action} \u2014 Case #${caseId}`, lines)

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, payload)
    }

    logger.info(`[MOD] ban: ${target.id} by ${interaction.user.id} in ${guild.id} \u2014 ${reason}`)
    await interaction.editReply(payload)
  }
}
