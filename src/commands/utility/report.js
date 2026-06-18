'use strict'

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 60,

  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a user to the mod team')
    .addUserOption(o => o.setName('user').setDescription('User to report').setRequired(false)),

  async execute (client, interaction) {
    const prefill = interaction.options.getUser('user')

    const modal = new ModalBuilder()
      .setCustomId('report_user')
      .setTitle('Report a User')

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('report_target_id')
          .setLabel('User ID or mention')
          .setStyle(TextInputStyle.Short)
          .setValue(prefill?.id ?? '')
          .setRequired(true)
          .setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('report_reason')
          .setLabel('Reason for report')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('report_evidence')
          .setLabel('Evidence (links, screenshots, etc.)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
      )
    )

    await interaction.showModal(modal)
  }
}
