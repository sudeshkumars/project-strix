'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { safeSend } = require('../../shared/utils')
const { EmbedBuilder } = require('discord.js')

module.exports = {
  name:     'birthdayTask',
  interval: '0 9 * * *',   // 9am UTC daily

  async execute (client) {
    const now   = new Date()
    const month = now.getUTCMonth() + 1
    const day   = now.getUTCDate()

    const birthdays = db.getTodayBirthdays(month, day)
    if (!birthdays.length) return

    for (const entry of birthdays) {
      const guild = client.guilds.cache.get(entry.guild_id)
      if (!guild) continue

      const config = client.guildCache.get(entry.guild_id)
      const channelId = config?.updates_channel_id ?? config?.welcome_channel
      if (!channelId) continue

      const channel = guild.channels.cache.get(channelId)
      if (!channel) continue

      let member
      try { member = await guild.members.fetch(entry.user_id) } catch { continue }

      const embed = new EmbedBuilder()
        .setColor(0xF4A460)
        .setTitle('🎂 Happy Birthday!')
        .setDescription(`Today is ${member}'s birthday! Wish them a happy one! 🎉`)
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setTimestamp()

      await safeSend(channel, { embeds: [embed] })
      logger.task('birthdayTask', `announced ${entry.user_id} in ${entry.guild_id}`)
    }
  }
}
