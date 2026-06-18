'use strict'

const { EmbedBuilder }   = require('discord.js')
const { success, error } = require('../../../shared/embed')

module.exports = {
  id: 'embed_builder',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const title       = interaction.fields.getTextInputValue('embed_title')?.trim() || null
    const description = interaction.fields.getTextInputValue('embed_description')?.trim() || null
    const colorStr    = interaction.fields.getTextInputValue('embed_color')?.trim() || '#5865F2'
    const footer      = interaction.fields.getTextInputValue('embed_footer')?.trim() || null
    const channelId   = interaction.fields.getTextInputValue('embed_channel')?.trim().replace(/\D/g, '') || null

    if (!title && !description) {
      return interaction.editReply({ embeds: [error('Empty embed', 'Provide at least a title or description.')] })
    }

    const color = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2

    const embed = new EmbedBuilder().setColor(color)
    if (title)       embed.setTitle(title)
    if (description) embed.setDescription(description)
    if (footer)      embed.setFooter({ text: footer })
    embed.setTimestamp()

    const target = channelId
      ? interaction.guild?.channels.cache.get(channelId)
      : interaction.channel

    if (!target?.isTextBased()) {
      return interaction.editReply({ embeds: [error('Invalid channel', 'Could not find the target channel.')] })
    }

    try {
      await target.send({ embeds: [embed] })
    } catch (e) {
      return interaction.editReply({ embeds: [error('Failed', e.message)] })
    }

    return interaction.editReply({ embeds: [success('Embed Sent', `Embed sent to ${target}.`)] })
  }
}
