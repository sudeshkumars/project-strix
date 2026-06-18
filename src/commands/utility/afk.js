'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { successCard, infoCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown:  10,

  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set or remove your AFK status')
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set your AFK status')
      .addStringOption(o => o.setName('reason').setDescription('AFK reason').setRequired(false)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove your AFK status')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const userId  = interaction.user.id

    if (sub === 'set') {
      const reason = interaction.options.getString('reason') || 'AFK'
      db.setAfk(userId, guildId, reason)

      return interaction.editReply(successCard('AFK Set', [
        `You are now AFK: **${reason}**`,
        'Your AFK will be removed when you send a message.'
      ]))
    }

    if (sub === 'remove') {
      const afk = db.getAfk(userId, guildId)
      if (!afk) {
        return interaction.editReply(infoCard('Not AFK', ['You are not currently AFK.']))
      }

      db.removeAfk(userId, guildId)
      return interaction.editReply(successCard('AFK Removed', ['Welcome back! Your AFK status has been removed.']))
    }
  }
}
