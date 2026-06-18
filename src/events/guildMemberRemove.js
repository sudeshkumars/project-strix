'use strict'

const db            = require('../../shared/db')
const { getConfig } = require('../../shared/cache')
const { safeSend, resolveWelcomeVars } = require('../../shared/utils')

module.exports = {
  name: 'guildMemberRemove',
  async execute (client, member) {
    const guildId = member.guild.id
    const config  = getConfig(client, guildId)

    db.incrementActivityStat(guildId, 'leaves')

    if (!config?.goodbye_channel) return

    const ch = member.guild.channels.cache.get(config.goodbye_channel)
    if (!ch) return

    const text = resolveWelcomeVars(
      config.goodbye_message ?? '{username} has left {server}.',
      member
    )

    await safeSend(ch, { content: text })
  }
}
