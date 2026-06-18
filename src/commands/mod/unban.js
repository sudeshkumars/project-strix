'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                   = require('../../../shared/db')
const { modAction }        = require('../../../shared/embed')
const { safeSend }         = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const userId = interaction.options.getString('user_id').trim()
    const reason = interaction.options.getString('reason') ?? 'No reason provided'
    const guild  = interaction.guild
    const config = interaction.guildConfig

    let target
    try { target = await client.users.fetch(userId) } catch {
      return interaction.editReply({ content: '❌ Invalid user ID.' })
    }

    try {
      await guild.members.unban(userId, `[Stryx] ${reason} | Mod: ${interaction.user.tag}`)
    } catch {
      return interaction.editReply({ content: '❌ Could not unban — user may not be banned.' })
    }

    db.clearTempPunishment(guild.id, userId, 'ban')

    const caseId = db.createCase(guild.id, userId, interaction.user.id, 'unban', reason)
    const embed  = modAction({ action: 'Unban', target, mod: interaction.user, reason, caseId })

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, { embeds: [embed] })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
