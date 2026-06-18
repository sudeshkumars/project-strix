'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { parseDuration, formatDuration } = require('../../../shared/utils')
const { successCard, errorCard, infoCard, capList } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: false,
  cooldown:  5,

  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set, list, or cancel reminders')
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set a reminder')
      .addStringOption(o => o.setName('time').setDescription('Duration (e.g. 2h, 30m, 1d)').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true))
      .addBooleanOption(o => o.setName('dm').setDescription('Send as DM (default true)').setRequired(false)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List your active reminders'))
    .addSubcommand(s => s
      .setName('cancel')
      .setDescription('Cancel a reminder by ID')
      .addIntegerOption(o => o.setName('id').setDescription('Reminder ID').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub    = interaction.options.getSubcommand()
    const userId = interaction.user.id

    if (sub === 'set') {
      const timeStr = interaction.options.getString('time')
      const message = interaction.options.getString('message')
      const dm      = interaction.options.getBoolean('dm') ?? true

      const seconds = parseDuration(timeStr)
      if (!seconds) {
        return interaction.editReply(errorCard('Invalid Time', ['Use a format like `2h`, `30m`, `1d`, `1w`']))
      }

      const remindAt  = Math.floor(Date.now() / 1000) + seconds
      const guildId   = interaction.guild?.id || null
      const channelId = interaction.channel?.id || null

      const id = db.createReminder(userId, guildId, channelId, message, remindAt, dm)

      return interaction.editReply(successCard('Reminder Set', [
        `**ID:** ${id}`,
        `**When:** <t:${remindAt}:R>`,
        `**Message:** ${message}`,
        `**Delivery:** ${dm ? 'DM' : 'Channel'}`
      ]))
    }

    if (sub === 'list') {
      const reminders = db.getUserReminders(userId)
      if (!reminders.length) {
        return interaction.editReply(infoCard('Your Reminders', ['You have no active reminders.']))
      }

      const lines = capList(reminders, 10, r =>
        `**#${r.id}** - <t:${r.remind_at}:R> - ${r.content.slice(0, 50)}`
      )

      return interaction.editReply(infoCard('Your Reminders', lines))
    }

    if (sub === 'cancel') {
      const id = interaction.options.getInteger('id')
      db.deleteReminder(id, userId)
      return interaction.editReply(successCard('Reminder Cancelled', [`Reminder **#${id}** has been cancelled.`]))
    }
  }
}
