'use strict'

const { AuditLogEvent } = require('discord.js')
const { trackAction, ACTION_TYPES } = require('./antiNuke')
const logger = require('../../shared/logger')

module.exports = {
  name: 'roleDelete',
  async execute (client, role) {
    if (!role.guild) return

    // Fetch audit log to determine who deleted the role
    try {
      const auditLogs = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleDelete,
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

      trackAction(client, role.guild.id, executorId, ACTION_TYPES.ROLE_DELETE)
    } catch (e) {
      logger.debug(`roleDelete antiNuke: ${e.message}`)
    }
  }
}
