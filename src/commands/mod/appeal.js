'use strict'

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js')
const db = require('../../../shared/db')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 60,

  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Appeal a moderation case')
    .addIntegerOption(o => o.setName('case_id').setDescription('Case ID to appeal').setRequired(true)),

  async execute (client, interaction) {
    const caseId = interaction.options.getInteger('case_id')
    const guild  = interaction.guild
    const config = interaction.guildConfig

    if (!config?.appeal_channel) {
      return interaction.reply({
        content: '❌ This server has not configured an appeal channel. Contact a moderator directly.',
        ephemeral: true
      })
    }

    // Fetch the case and verify it belongs to this user
    const modCase = db.getCase(caseId, guild.id)

    if (!modCase) {
      return interaction.reply({ content: '❌ Case not found.', ephemeral: true })
    }

    if (modCase.user_id !== interaction.user.id) {
      return interaction.reply({
        content: '❌ You can only appeal cases that belong to you.',
        ephemeral: true
      })
    }

    // Types that can be appealed
    const appealable = ['warn', 'mute', 'tempban', 'ban', 'kick', 'softban']
    if (!appealable.includes(modCase.type)) {
      return interaction.reply({
        content: `❌ Case type \`${modCase.type}\` cannot be appealed.`,
        ephemeral: true
      })
    }

    // Show modal — customId matches appeal_submit handler (uses 'appeal_submit' prefix)
    const modal = new ModalBuilder()
      .setCustomId('appeal_submit')
      .setTitle(`Appeal — Case #${caseId}`)

    const caseIdInput = new TextInputBuilder()
      .setCustomId('case_id')
      .setLabel('Case ID')
      .setStyle(TextInputStyle.Short)
      .setValue(String(caseId))
      .setRequired(true)

    const reasonInput = new TextInputBuilder()
      .setCustomId('appeal_reason')
      .setLabel('Why should this action be reversed?')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(20)
      .setMaxLength(1000)
      .setPlaceholder('Explain your appeal clearly and honestly...')
      .setRequired(true)

    const extraInput = new TextInputBuilder()
      .setCustomId('extra_info')
      .setLabel('Additional information (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(500)
      .setRequired(false)

    modal.addComponents(
      new ActionRowBuilder().addComponents(caseIdInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(extraInput)
    )

    await interaction.showModal(modal)
  }
}
