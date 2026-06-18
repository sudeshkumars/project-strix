'use strict'

const cron   = require('node-cron')
const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { safeSend } = require('../../shared/utils')

// Track active cron jobs: Map<scheduleId, CronJob>
const jobs = new Map()

module.exports = {
  name:     'schedulerTask',
  interval: '* * * * *',   // check every minute for new/changed schedules

  async execute (client) {
    const rows = db.getAllScheduledMessages()

    // Stop jobs for deleted/disabled rows
    for (const [id, job] of jobs) {
      const row = rows.find(r => r.id === id)
      if (!row || !row.enabled) {
        job.stop()
        jobs.delete(id)
        logger.task('schedulerTask', `stopped job #${id}`)
      }
    }

    // Start new jobs
    for (const row of rows) {
      if (!row.enabled) continue
      if (jobs.has(row.id)) continue
      if (!cron.validate(row.cron)) continue

      const job = cron.schedule(row.cron, async () => {
        const guild = client.guilds.cache.get(row.guild_id)
        if (!guild) return

        const ch = guild.channels.cache.get(row.channel_id)
        if (!ch) return

        const payload = {}
        if (row.content) payload.content = row.content
        if (row.embed) {
          try {
            const { EmbedBuilder } = require('discord.js')
            const data = JSON.parse(row.embed)
            const e = new EmbedBuilder()
              .setColor(0x5865F2)
            if (data.title)       e.setTitle(data.title)
            if (data.description) e.setDescription(data.description)
            if (data.color)       e.setColor(data.color)
            payload.embeds = [e]
          } catch {}
        }

        await safeSend(ch, payload)
        db.updateScheduledLastRun(row.id)
        logger.task('schedulerTask', `fired #${row.id} in ${row.guild_id}`)
      })

      jobs.set(row.id, job)
      logger.task('schedulerTask', `started job #${row.id} (${row.cron})`)
    }
  }
}
