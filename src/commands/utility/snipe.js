'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { COLORS } = require('../../../shared/embed')

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
      return interaction.editReply({ content: '🔍 No recently deleted messages in that channel.' })
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setAuthor({
        name:    snipe.author.tag,
        iconURL: snipe.author.displayAvatarURL({ size: 64 })
      })
      .setDescription(snipe.content?.slice(0, 2000) || '*(no text content)*')
      .addFields({ name: 'Channel', value: `<#${channel.id}>`, inline: true })
      .setFooter({ text: `Deleted` })
      .setTimestamp(snipe.deletedAt)

    if (snipe.imageUrl) embed.setImage(snipe.imageUrl)

    await interaction.editReply({ embeds: [embed] })
  }
}
