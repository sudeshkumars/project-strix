'use strict'

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')

module.exports = {
  id: 'ticket_close_modal',

  async execute (client, interaction, config) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_close_reason')
      .setTitle('Close Ticket')

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Reason for closing')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
          .setPlaceholder('Optional — describe why this ticket is being closed.')
      )
    )

    await interaction.showModal(modal)
  }
}
