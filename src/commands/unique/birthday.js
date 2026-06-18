'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Birthday system')
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set your birthday')
      .addIntegerOption(o => o.setName('month').setDescription('Month (1-12)').setMinValue(1).setMaxValue(12).setRequired(true))
      .addIntegerOption(o => o.setName('day').setDescription('Day (1-31)').setMinValue(1).setMaxValue(31).setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove your birthday'))
    .addSubcommand(s => s
      .setName('check')
      .setDescription('Check a user\'s birthday')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const userId  = interaction.user.id
    const guildId = interaction.guild.id

    db.upsertUser(userId, guildId)

    if (sub === 'set') {
      const month = interaction.options.getInteger('month')
      const day   = interaction.options.getInteger('day')

      // Basic date validation
      const date = new Date(2000, month - 1, day)
      if (date.getMonth() !== month - 1) {
        return interaction.editReply({ embeds: [error('Invalid date', `Day ${day} is not valid for month ${month}.`)] })
      }

      const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      db.updateUser(userId, guildId, { birthday: key })
      return interaction.editReply({ embeds: [success('Birthday Set', `Your birthday is set to **${key}**. 🎂`)] })
    }

    if (sub === 'remove') {
      db.updateUser(userId, guildId, { birthday: null })
      return interaction.editReply({ embeds: [success('Birthday Removed', 'Your birthday has been removed.')] })
    }

    if (sub === 'check') {
      const target = interaction.options.getUser('user') ?? interaction.user
      db.upsertUser(target.id, guildId)
      const row = db.getUser(target.id, guildId)

      if (!row?.birthday) {
        return interaction.editReply({ content: `${target.tag} has not set their birthday.` })
      }

      const [m, d] = row.birthday.split('-')
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const label  = `${months[parseInt(m) - 1]} ${parseInt(d)}`

      return interaction.editReply({ embeds: [info('🎂 Birthday', `${target}'s birthday is **${label}**.`)] })
    }
  }
}
