'use strict'

const logger = require('../../shared/logger')
const { sendLog } = require('../../shared/logRouter')

const ACTION_TYPES = {
  CHANNEL_DELETE: 'channel_delete',
  ROLE_DELETE:    'role_delete',
  MASS_BAN:      'mass_ban'
}

const THRESHOLDS = {
  [ACTION_TYPES.CHANNEL_DELETE]: 3,
  [ACTION_TYPES.ROLE_DELETE]:    3,
  [ACTION_TYPES.MASS_BAN]:      5
}

const WINDOW_MS = 10_000 // 10 seconds

// Map<guildId, Map<userId, { type: string, timestamps: number[] }[]>>
const actionLog = new Map()

/**
 * Track a destructive action for a user in a guild.
 * Returns true if the threshold was hit (nuke detected).
 */
function trackAction (client, guildId, userId, actionType) {
  // Never trigger on bot owner
  if (userId === process.env.BOT_OWNER_ID) return false

  if (!actionLog.has(guildId)) actionLog.set(guildId, new Map())
  const guildActions = actionLog.get(guildId)

  if (!guildActions.has(userId)) guildActions.set(userId, [])
  const userActions = guildActions.get(userId)

  const now = Date.now()
  userActions.push({ type: actionType, ts: now })

  // Clean old entries outside window
  const cutoff = now - WINDOW_MS
  const filtered = userActions.filter(a => a.ts >= cutoff)
  guildActions.set(userId, filtered)

  // Count actions of this type within window
  const count = filtered.filter(a => a.type === actionType).length
  const threshold = THRESHOLDS[actionType] || 3

  if (count >= threshold) {
    // Clear the user's actions to prevent re-triggering
    guildActions.set(userId, [])
    triggerAntiNuke(client, guildId, userId, actionType, count).catch(e =>
      logger.error(`antiNuke trigger error: ${e.message}`)
    )
    return true
  }

  return false
}

async function triggerAntiNuke (client, guildId, userId, actionType, count) {
  const guild = client.guilds.cache.get(guildId)
  if (!guild) return

  logger.warn(`[AntiNuke] Triggered for user ${userId} in guild ${guildId}: ${actionType} x${count}`)

  // Strip all roles from the offending user
  try {
    const member = await guild.members.fetch(userId).catch(() => null)
    if (member) {
      const roles = member.roles.cache.filter(r => r.id !== guild.id)
      if (roles.size > 0) {
        await member.roles.remove(roles, '[Stryx AntiNuke] Mass destructive action detected')
      }
    }
  } catch (e) {
    logger.debug(`antiNuke: could not strip roles from ${userId}: ${e.message}`)
  }

  // DM guild owner
  try {
    const owner = await guild.fetchOwner()
    if (owner) {
      await owner.send({
        content: `\u26a0\ufe0f **Anti-Nuke Alert** in **${guild.name}**\n` +
          `User <@${userId}> triggered anti-nuke protection.\n` +
          `Action: **${actionType}** (${count} in 10s)\n` +
          `Their roles have been removed.`
      }).catch(() => {})
    }
  } catch {}

  // Log to mod_channel
  await sendLog(client, guildId, 'mod', {
    content: `\u26a0\ufe0f **Anti-Nuke Triggered**\n` +
      `**User:** <@${userId}>\n` +
      `**Action:** ${actionType} x${count} in 10s\n` +
      `**Response:** All roles stripped`
  })
}

module.exports = { trackAction, ACTION_TYPES }
