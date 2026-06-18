'use strict'

const { endPoll } = require('../../commands/community/poll')
const { resolveTier, TIERS } = require('../../../shared/permissions')

module.exports = {
  id: 'poll_end',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const poll = client.polls?.get(interaction.message.id)
    if (!poll) return interaction.editReply({ content: '❌ Poll not found.' })

    const tier = resolveTier(interaction.member, config)
    if (interaction.user.id !== poll.hostId && tier < TIERS.MOD) {
      return interaction.editReply({ content: '❌ Only the poll host or a mod can end this poll.' })
    }

    await endPoll(client, interaction.message.id)
    return interaction.editReply({ content: '✅ Poll ended.' })
  }
}
