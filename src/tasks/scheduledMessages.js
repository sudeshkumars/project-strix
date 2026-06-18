'use strict'

const cron   = require('node-cron')
const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { EmbedBuilder } = require('discord.js')
const { safeSend } = require('../../shared/utils')

// Runs every minute — fires any scheduled message whose cron matches now
module.exports = {
  name:     'scheduledMessages',
  interval: '* * * * *',

  async execute (client) {
    const msgs = db.getAllScheduledMessages()

    for (const msg of msgs) {
      if (!cron.validate(msg.cron)) continue

      // Check if this cron fires right now (within this minute)
      const schedule = cron.schedule(msg.cron, () => {}, { scheduled: false })
      const nextRun  = getNextRun(msg.cron)
      const now      = Math.floor(Date.now() / 1000)

      // Fire if we're within 60s of the scheduled time and it hasn't run this minute
      if (msg.last_run && now - msg.last_run < 55) continue
      if (!shouldFireNow(msg.cron)) continue

      const guild   = client.guilds.cache.get(msg.guild_id)
      if (!guild) continue

      const channel = guild.channels.cache.get(msg.channel_id)
      if (!channel) continue

      try {
        const payload = {}

        if (msg.content) payload.content = msg.content

        if (msg.embed) {
          const embedData = JSON.parse(msg.embed)
          payload.embeds  = [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle(embedData.title ?? null)
              .setDescription(embedData.description ?? null)
              .setTimestamp()
          ]
        }

        await safeSend(channel, payload)
        db.updateScheduledLastRun(msg.id)
        logger.task('scheduledMessages', `fired #${msg.id} in ${msg.guild_id}`)
      } catch (e) {
        logger.error(`scheduledMessages: failed #${msg.id}: ${e.message}`)
      }
    }
  }
}

function shouldFireNow (cronExpr) {
  const now  = new Date()
  const min  = now.getMinutes()
  const hour = now.getHours()
  const dom  = now.getDate()
  const mon  = now.getMonth() + 1
  const dow  = now.getDay()

  const parts = cronExpr.split(' ')
  if (parts.length !== 5) return false

  return (
    matchField(parts[0], min)  &&
    matchField(parts[1], hour) &&
    matchField(parts[2], dom)  &&
    matchField(parts[3], mon)  &&
    matchField(parts[4], dow)
  )
}

function matchField (field, val) {
  if (field === '*') return true
  if (field.includes('/')) {
    const [, step] = field.split('/')
    return val % parseInt(step) === 0
  }
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(val)
  }
  if (field.includes('-')) {
    const [a, b] = field.split('-').map(Number)
    return val >= a && val <= b
  }
  return parseInt(field) === val
}

function getNextRun (cronExpr) {
  return null // placeholder — not needed for fire logic
}
