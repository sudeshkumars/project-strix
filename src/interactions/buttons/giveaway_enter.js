'use strict'

const db = require('../../../shared/db')

module.exports = {
  id: 'giveaway_enter',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const [, gwId] = interaction.customId.split(':')
    const gw = db.getGiveaway(parseInt(gwId))

    if (!gw || gw.ended) {
      return interaction.editReply({ content: '❌ This giveaway has ended.' })
    }

    const member = interaction.member
    const userId = interaction.user.id

    // Required role check
    if (gw.required_role && !member.roles.cache.has(gw.required_role)) {
      return interaction.editReply({ content: `❌ You need <@&${gw.required_role}> to enter this giveaway.` })
    }

    // Init entry map on client
    if (!client.giveawayEntries) client.giveawayEntries = new Map()
    if (!client.giveawayEntries.has(gw.id)) client.giveawayEntries.set(gw.id, new Map())

    const pool = client.giveawayEntries.get(gw.id)

    // Toggle entry
    if (pool.has(userId)) {
      pool.delete(userId)
      return interaction.editReply({ content: '✅ You have withdrawn from this giveaway.' })
    }

    // Bonus entries
    let entries = 1
    if (gw.bonus_role && member.roles.cache.has(gw.bonus_role)) {
      entries = gw.bonus_entries ?? 2
    }

    pool.set(userId, entries)
    return interaction.editReply({
      content: `🎉 You have entered the giveaway for **${gw.prize}**!${entries > 1 ? ` (+${entries - 1} bonus entries)` : ''}\nTotal entries: **${pool.size}**`
    })
  }
}
