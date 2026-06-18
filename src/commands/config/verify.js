'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }         = require('../../../shared/cache')
const { buildCardPayload, successCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Manage verification gate')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Set up a verification panel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for the verify panel').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to give on verify').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Custom verification message').setRequired(false)))
    .addSubcommand(s => s
      .setName('disable')
      .setDescription('Remove verification')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel')
      const role    = interaction.options.getRole('role')
      const message = interaction.options.getString('message') || 'Click the button below to verify and gain access to the server.'

      // Update guild config with verify_role
      updateConfig(client, guildId, { verify_role: role.id }, { verify_role: role.id })

      // Send verification panel to the channel
      const payload = buildCardPayload({
        accent: 'info',
        title: 'Verification Required',
        lines: [message],
        buttons: [
          { id: 'verify_btn', label: 'Verify', emoji: '\u2705', style: 3 }
        ]
      })

      try {
        await channel.send(payload)
      } catch (e) {
        return interaction.editReply(errorCard('Error', [`Could not send to ${channel}: ${e.message}`]))
      }

      return interaction.editReply(successCard('Verification Setup', [
        `**Channel:** ${channel}`,
        `**Role:** ${role}`,
        'Panel has been sent to the channel.'
      ]))
    }

    if (sub === 'disable') {
      updateConfig(client, guildId, { verify_role: null }, { verify_role: null })
      return interaction.editReply(successCard('Verification Disabled', ['Verification gate has been disabled.']))
    }
  }
}
