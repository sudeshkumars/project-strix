'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                   = require('../../../shared/db')
const { modAction, modDm } = require('../../../shared/embed')
const { safeSend }         = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target = interaction.options.getUser('user')
    const reason = interaction.options.getString('reason') ?? 'No reason provided'
    const guild  = interaction.guild
    const config = interaction.guildConfig

    let member
    try { member = await guild.members.fetch(target.id) } catch {
      return interaction.editReply({ content: '❌ Member not found in this server.' })
    }

    if (!member.kickable) return interaction.editReply({ content: '❌ I cannot kick that member.' })
    if (member.id === interaction.user.id) return interaction.editReply({ content: '❌ You cannot kick yourself.' })

    if (config?.dm_on_action) {
      await safeSend(target, {
        embeds: [modDm({ action: 'Kick', guildName: guild.name, reason })]
      })
    }

    try {
      await member.kick(`[Stryx] ${reason} | Mod: ${interaction.user.tag}`)
    } catch (e) {
      return interaction.editReply({ content: `❌ Failed to kick: ${e.message}` })
    }

    const caseId = db.createCase(guild.id, target.id, interaction.user.id, 'kick', reason)
    const embed  = modAction({ action: 'Kick', target, mod: interaction.user, reason, caseId })

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, { embeds: [embed] })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
