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
      return interaction.editReply(errorCard('Not Found', ['Member not found.']))
    }

    if (!member.isCommunicationDisabled()) {
      return interaction.editReply(errorCard('Not Muted', ['That member is not muted.']))
    }

    try {
      await member.timeout(null, `[Stryx] ${reason} | Mod: ${interaction.user.tag}`)
    } catch (e) {
      return interaction.editReply(errorCard('Unmute Failed', [e.message]))
    }

    db.clearTempPunishment(guild.id, target.id, 'mute')

    const caseId = db.createCase(guild.id, target.id, interaction.user.id, 'unmute', reason)
    const lines = [
      `**User** \u2014 ${target.username} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.username} (\`${interaction.user.id}\`)`,
      `**Reason** \u2014 ${reason}`
    ]

    const payload = modCard(`\u{1f528} Unmute \u2014 Case #${caseId}`, lines)

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, payload)
    }

    await interaction.editReply(payload)
  }
}
