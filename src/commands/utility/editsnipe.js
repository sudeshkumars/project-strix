'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { COLORS } = require('../../../shared/embed')

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
      return interaction.editReply({ content: '🔍 No recently edited messages in that channel.' })
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setAuthor({
        name:    snipe.author.tag,
        iconURL: snipe.author.displayAvatarURL({ size: 64 })
      })
      .addFields(
        { name: 'Before', value: snipe.before?.slice(0, 1024) || '*(empty)*', inline: false },
        { name: 'After',  value: snipe.after?.slice(0, 1024)  || '*(empty)*', inline: false },
        { name: 'Channel', value: `<#${channel.id}>`, inline: true }
      )
      .setFooter({ text: 'Edited' })
      .setTimestamp(snipe.editedAt)

    await interaction.editReply({ embeds: [embed] })
  }
}
