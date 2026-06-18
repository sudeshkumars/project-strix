'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                    = require('../../../shared/db')
const { modCard, errorCard } = require('../../../shared/components')
const { modDm }             = require('../../../shared/embed')
const { parseDuration, formatDuration, safeSend } = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a member for a set duration')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to temp-ban').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1d, 7d, 2w').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target     = interaction.options.getUser('user')
    const durStr     = interaction.options.getString('duration')
    const reason     = interaction.options.getString('reason') ?? 'No reason provided'
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0
    const guild      = interaction.guild
    const config     = interaction.guildConfig

    const secs = parseDuration(durStr)
    if (!secs) return interaction.editReply(errorCard('Invalid Duration', ['Use e.g. `1d`, `7d`, `2w`.']))

    const durLabel  = formatDuration(secs)
    const expiresAt = Math.floor(Date.now() / 1000) + secs

    let member
    try { member = await guild.members.fetch(target.id) } catch {}

    if (member) {
      if (!member.bannable) return interaction.editReply(errorCard('Cannot Ban', ['I cannot ban that member (role hierarchy).']))
      if (member.id === interaction.user.id) return interaction.editReply(errorCard('Invalid', ['You cannot ban yourself.']))
    }

    if (config?.dm_on_action && member) {
      await safeSend(target, {
        embeds: [modDm({
          action: 'Temp-Ban',
          guildName: guild.name,
          reason,
          duration: durLabel,
          appealChannel: config.appeal_channel ? `<#${config.appeal_channel}>` : null
        })]
      })
    }

    try {
      await guild.members.ban(target.id, {
        reason: `[Stryx Tempban] ${reason} | Mod: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400
      })
    } catch (e) {
      return interaction.editReply(errorCard('Ban Failed', [e.message]))
    }

    const caseId = db.createCase(guild.id, target.id, interaction.user.id, 'tempban', reason, expiresAt)
    db.createTempPunishment(guild.id, target.id, 'ban', expiresAt, caseId)

    const lines = [
      `**User** \u2014 ${target.username} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.username} (\`${interaction.user.id}\`)`,
      `**Reason** \u2014 ${reason}`,
      `**Duration** \u2014 ${durLabel}`
    ]

    const payload = modCard(`\u{1f528} Temp Ban \u2014 Case #${caseId}`, lines)

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, payload)
    }

    await interaction.editReply(payload)
  }
}
