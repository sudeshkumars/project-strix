'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { infoCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('Show the last edited message in this channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply()

    const channel = interaction.options.getChannel('channel') ?? interaction.channel
    const snipe   = client.editCache?.get(channel.id)

    if (!snipe) {
      return interaction.editReply(errorCard('No Snipe', ['\u{1f50d} No recently edited messages in that channel.']))
    }

    const lines = [
      `**Author** \u2014 ${snipe.author.tag}`,
      `**Channel** \u2014 <#${channel.id}>`
    ]

    const blocks = [
      { heading: 'Before', content: snipe.before?.slice(0, 1024) || '*(empty)*' },
      { heading: 'After', content: snipe.after?.slice(0, 1024) || '*(empty)*' }
    ]

    await interaction.editReply(infoCard('\u270f\ufe0f Edited Message', lines, { blocks }))
  }
}
