'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js')
const { error } = require('../../../shared/embed')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post a ticket open panel in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(false))
    .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(false))
    .addStringOption(o => o.setName('button_label').setDescription('Button label').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Embed color hex e.g. #5865F2').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const channel     = interaction.options.getChannel('channel')
    const title       = interaction.options.getString('title')       ?? '🎫 Support Tickets'
    const description = interaction.options.getString('description') ?? 'Click the button below to open a support ticket.\nOur team will assist you shortly.'
    const label       = interaction.options.getString('button_label') ?? 'Open Ticket'
    const colorStr    = interaction.options.getString('color') ?? '#5865F2'
    const color       = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2

    if (!channel.isTextBased()) {
      return interaction.editReply({ embeds: [error('Invalid channel', 'Please select a text channel.')] })
    }

    const { EmbedBuilder } = require('discord.js')
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_open')
        .setLabel(label)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    )

    try {
      await channel.send({ embeds: [embed], components: [row] })
    } catch (e) {
      return interaction.editReply({ embeds: [error('Failed', `Could not post panel: ${e.message}`)] })
    }

    await interaction.editReply({ content: `✅ Ticket panel posted in ${channel}.` })
  }
}
