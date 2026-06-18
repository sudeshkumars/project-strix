'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { successCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds between messages (0 to disable, max 21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const secs    = interaction.options.getInteger('seconds')
    const channel = interaction.options.getChannel('channel') ?? interaction.channel

    try {
      await channel.setRateLimitPerUser(secs, `Slowmode set by ${interaction.user.tag}`)
    } catch (e) {
      return interaction.editReply(errorCard('Error', [e.message]))
    }

    const msg = secs === 0
      ? `Slowmode disabled in ${channel}.`
      : `Slowmode set to **${secs}s** in ${channel}.`

    await interaction.editReply(successCard('Slowmode Updated', [msg]))
  }
}
