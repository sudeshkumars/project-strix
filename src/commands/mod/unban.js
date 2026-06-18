'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                    = require('../../../shared/db')
const { modCard, errorCard } = require('../../../shared/components')
const { safeSend }          = require('../../../shared/utils')

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
      return interaction.editReply(errorCard('Invalid', ['Invalid user ID.']))
    }

    try {
      await guild.members.unban(userId, `[Stryx] ${reason} | Mod: ${interaction.user.tag}`)
    } catch {
      return interaction.editReply(errorCard('Failed', ['Could not unban \u2014 user may not be banned.']))
    }

    db.clearTempPunishment(guild.id, userId, 'ban')

    const caseId = db.createCase(guild.id, userId, interaction.user.id, 'unban', reason)
    const lines = [
      `**User** \u2014 ${target.username} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.username} (\`${interaction.user.id}\`)`,
      `**Reason** \u2014 ${reason}`
    ]

    const payload = modCard(`\u{1f528} Unban \u2014 Case #${caseId}`, lines)

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, payload)
    }

    await interaction.editReply(payload)
  }
}
