'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                    = require('../../../shared/db')
const { modCard, errorCard } = require('../../../shared/components')
const { modDm }             = require('../../../shared/embed')
const { safeSend }          = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban then immediately unban a member to purge their messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to softban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to purge (default 7)').setMinValue(1).setMaxValue(7).setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target     = interaction.options.getUser('user')
    const reason     = interaction.options.getString('reason') ?? 'No reason provided'
    const deleteDays = interaction.options.getInteger('delete_days') ?? 7
    const guild      = interaction.guild
    const config     = interaction.guildConfig

    let member
    try { member = await guild.members.fetch(target.id) } catch {}

    if (member) {
      if (!member.bannable) return interaction.editReply(errorCard('Cannot Ban', ['I cannot ban that member (role hierarchy).']))
      if (member.id === interaction.user.id) return interaction.editReply(errorCard('Invalid', ['You cannot softban yourself.']))
    }

    if (config?.dm_on_action && member) {
      await safeSend(target, {
        embeds: [modDm({ action: 'Softban', guildName: guild.name, reason })]
      })
    }

    try {
      await guild.members.ban(target.id, {
        reason: `[Stryx Softban] ${reason} | Mod: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400
      })
      await guild.members.unban(target.id, '[Stryx Softban] Auto-unban after softban')
    } catch (e) {
      return interaction.editReply(errorCard('Softban Failed', [e.message]))
    }

    const caseId = db.createCase(guild.id, target.id, interaction.user.id, 'softban', reason)
    const lines = [
      `**User** \u2014 ${target.username} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.username} (\`${interaction.user.id}\`)`,
      `**Reason** \u2014 ${reason}`
    ]

    const payload = modCard(`\u{1f528} Softban \u2014 Case #${caseId}`, lines)

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, payload)
    }

    await interaction.editReply(payload)
  }
}
