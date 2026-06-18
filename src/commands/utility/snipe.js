'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { warnCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Show the last deleted message in this channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to snipe').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply()

    const channel = interaction.options.getChannel('channel') ?? interaction.channel
    const snipe   = client.snipeCache?.get(channel.id)

    if (!snipe) {
      return interaction.editReply(errorCard('No Snipe', ['\u{1f50d} No recently deleted messages in that channel.']))
    }

    const lines = [
      `**Author** \u2014 ${snipe.author.tag}`,
      `**Channel** \u2014 <#${channel.id}>`,
      `**Content** \u2014 ${snipe.content?.slice(0, 1500) || '*(no text content)*'}`
    ]

    await interaction.editReply(warnCard('\u{1f5d1}\ufe0f Deleted Message', lines, {
      image: snipe.imageUrl || undefined
    }))
  }
}
