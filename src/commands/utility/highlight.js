'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { safeSend }             = require('../../../shared/utils')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('highlight')
    .setDescription('Get notified when a word is mentioned')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a highlight word')
      .addStringOption(o => o.setName('word').setDescription('Word to highlight').setRequired(true).setMaxLength(50)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a highlight word')
      .addStringOption(o => o.setName('word').setDescription('Word to remove').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List your highlight words'))
    .addSubcommand(s => s
      .setName('clear')
      .setDescription('Clear all your highlights')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const userId  = interaction.user.id

    if (sub === 'add') {
      const word     = interaction.options.getString('word').toLowerCase()
      const existing = db.getUserHighlights(guildId, userId)

      if (existing.length >= 20) {
        return interaction.editReply({ embeds: [error('Limit reached', 'You can have at most 20 highlights.')] })
      }
      if (existing.find(h => h.word === word)) {
        return interaction.editReply({ embeds: [error('Already added', `\`${word}\` is already in your highlights.`)] })
      }

      db.addHighlight(guildId, userId, word)
      return interaction.editReply({ embeds: [success('Highlight Added', `You'll be notified when \`${word}\` is mentioned.`)] })
    }

    if (sub === 'remove') {
      const word = interaction.options.getString('word').toLowerCase()
      db.removeHighlight(guildId, userId, word)
      return interaction.editReply({ embeds: [success('Removed', `\`${word}\` removed from highlights.`)] })
    }

    if (sub === 'list') {
      const highlights = db.getUserHighlights(guildId, userId)
      if (!highlights.length) return interaction.editReply({ content: 'You have no highlight words.' })

      const embed = info('🔔 Your Highlights', highlights.map(h => `\`${h.word}\``).join(', '))
      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'clear') {
      const highlights = db.getUserHighlights(guildId, userId)
      for (const h of highlights) db.removeHighlight(guildId, userId, h.word)
      return interaction.editReply({ embeds: [success('Cleared', 'All highlights removed.')] })
    }
  }
}
