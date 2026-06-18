'use strict'

const db = require('../../shared/db')

module.exports = {
  name: 'voiceStateUpdate',
  async execute (client, oldState, newState) {
    // Only care about leaves
    if (!oldState.channelId) return
    if (oldState.channelId === newState.channelId) return

    const channel = oldState.channel
    if (!channel) return

    // Is it a temp voice channel?
    const vc = db.getTempVoice(channel.id)
    if (!vc) return

    // Delete if empty
    if (channel.members.size === 0) {
      try { await channel.delete('Temp VC empty') } catch {}
      db.deleteTempVoice(channel.id)
    }
  }
}
