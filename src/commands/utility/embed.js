'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder
} = require('discord.js')
const { error } = require('../../../shared/embed')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom embed message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send in').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(false).setMaxLength(256))
    .addStringOption(o => o.setName('description').setDescription('Embed description').setRequired(false).setMaxLength(4096))
    .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #5865F2').setRequired(false))
    .addStringOption(o => o.setName('footer').setDescription('Footer text').setRequired(false).setMaxLength(2048))
    .addStringOption(o => o.setName('image').setDescription('Image URL').setRequired(false))
    .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail URL').setRequired(false))
    .addBooleanOption(o => o.setName('timestamp').setDescription('Add timestamp').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const channel     = interaction.options.getChannel('channel')
    const title       = interaction.options.getString('title')
    const description = interaction.options.getString('description')
    const colorStr    = interaction.options.getString('color')
    const footer      = interaction.options.getString('footer')
    const image       = interaction.options.getString('image')
    const thumbnail   = interaction.options.getString('thumbnail')
    const timestamp   = interaction.options.getBoolean('timestamp') ?? false

    if (!title && !description) {
      return interaction.editReply({ embeds: [error('Empty embed', 'Provide at least a title or description.')] })
    }

    const color = colorStr ? parseInt(colorStr.replace('#', ''), 16) || 0x5865F2 : 0x5865F2

    const embed = new EmbedBuilder().setColor(color)

    if (title)       embed.setTitle(title)
    if (description) embed.setDescription(description)
    if (footer)      embed.setFooter({ text: footer })
    if (image)       embed.setImage(image)
    if (thumbnail)   embed.setThumbnail(thumbnail)
    if (timestamp)   embed.setTimestamp()

    try {
      await channel.send({ embeds: [embed] })
    } catch (e) {
      return interaction.editReply({ embeds: [error('Failed', e.message)] })
    }

    await interaction.editReply({ content: `✅ Embed sent to ${channel}.` })
  }
}
