'use strict'

const { buildPollEmbed } = require('../../commands/community/poll')

module.exports = {
  id: 'poll_vote',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const [, indexStr] = interaction.customId.split(':')
    const index = parseInt(indexStr)
    const poll  = client.polls?.get(interaction.message.id)

    if (!poll) return interaction.editReply({ content: '❌ Poll not found or has ended.' })
    if (poll.ended) return interaction.editReply({ content: '❌ This poll has ended.' })

    const userId = interaction.user.id

    // Toggle vote — remove from all other options first
    let removed = false
    for (let i = 0; i < poll.votes.length; i++) {
      if (i === index) continue
      poll.votes[i].delete(userId)
    }

    if (poll.votes[index].has(userId)) {
      poll.votes[index].delete(userId)
      removed = true
    } else {
      poll.votes[index].add(userId)
    }

    // Update embed
    const host = await interaction.client.users.fetch(poll.hostId).catch(() => ({ tag: 'Unknown' }))
    const embed = buildPollEmbed(poll.question, poll.options, poll.votes, poll.anon, poll.endsAt, host)

    try { await interaction.message.edit({ embeds: [embed] }) } catch {}

    const optLabel = poll.options[index]
    return interaction.editReply({
      content: removed
        ? `🗑️ Removed your vote from **${optLabel}**.`
        : `✅ Voted for **${optLabel}**.`
    })
  }
}
