'use strict'

const { AuditLogEvent } = require('discord.js')
const { trackAction, ACTION_TYPES } = require('./antiNuke')
const logger = require('../../shared/logger')

module.exports = {
  name: 'channelDelete',
  async execute (client, channel) {
    if (!channel.guild) return

    // Fetch audit log to determine who deleted the channel
    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 1
      })
      const entry = auditLogs.entries.first()
      if (!entry) return

      // Only track if the action was recent (within 5 seconds)
      const diff = Date.now() - entry.createdTimestamp
      if (diff > 5000) return

      const executorId = entry.executor.id
      // Skip bots
      if (entry.executor.bot) return

      trackAction(client, channel.guild.id, executorId, ACTION_TYPES.CHANNEL_DELETE)
    } catch (e) {
      logger.debug(`channelDelete antiNuke: ${e.message}`)
    }
  }
}
