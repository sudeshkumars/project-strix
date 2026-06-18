'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { successCard, errorCard } = require('../../../shared/components')

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('amount').setDescription('Messages to delete (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user').setRequired(false))
    .addStringOption(o => o.setName('filter').setDescription('Only delete messages containing this text').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const amount   = interaction.options.getInteger('amount')
    const user     = interaction.options.getUser('user')
    const filter   = interaction.options.getString('filter')?.toLowerCase()
    const channel  = interaction.channel

    let messages
    try {
      messages = await channel.messages.fetch({ limit: user || filter ? 100 : amount })
    } catch {
      return interaction.editReply(errorCard('Error', ['Failed to fetch messages.']))
    }

    const now = Date.now()
    let filtered = messages.filter(m => (now - m.createdTimestamp) < TWO_WEEKS)

    if (user)   filtered = filtered.filter(m => m.author.id === user.id)
    if (filter) filtered = filtered.filter(m => m.content.toLowerCase().includes(filter))

    const toDelete = filtered.first(amount)

    if (!toDelete.length) {
      return interaction.editReply(errorCard('Nothing to delete', ['No matching messages found (messages older than 14 days cannot be bulk deleted).']))
    }

    let deleted
    try {
      const result = await channel.bulkDelete(toDelete, true)
      deleted = result.size
    } catch (e) {
      return interaction.editReply(errorCard('Error', [`Bulk delete failed: ${e.message}`]))
    }

    await interaction.editReply(successCard('Messages Purged', [`Deleted **${deleted}** message${deleted !== 1 ? 's' : ''}.`]))
  }
}
