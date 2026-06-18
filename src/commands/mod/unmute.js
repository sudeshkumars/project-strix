'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db            = require('../../../shared/db')
const { modAction } = require('../../../shared/embed')
const { safeSend }  = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to unmute').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target = interaction.options.getUser('user')
    const reason = interaction.options.getString('reason') ?? 'No reason provided'
    const guild  = interaction.guild
    const config = interaction.guildConfig

    let member
    try { member = await guild.members.fetch(target.id) } catch {
      return interaction.editReply({ content: '❌ Member not found.' })
    }

    if (!member.isCommunicationDisabled()) {
      return interaction.editReply({ content: '❌ That member is not muted.' })
    }

    try {
      await member.timeout(null, `[Stryx] ${reason} | Mod: ${interaction.user.tag}`)
    } catch (e) {
      return interaction.editReply({ content: `❌ Failed to unmute: ${e.message}` })
    }

    db.clearTempPunishment(guild.id, target.id, 'mute')

    const caseId = db.createCase(guild.id, target.id, interaction.user.id, 'unmute', reason)
    const embed  = modAction({ action: 'Unmute', target, mod: interaction.user, reason, caseId })

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, { embeds: [embed] })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
