'use strict'

const { EmbedBuilder } = require('discord.js')
const { sendLog }      = require('../../shared/logRouter')
const { COLORS }       = require('../../shared/embed')
const db               = require('../../shared/db')

module.exports = {
  name: 'guildBanAdd',
  async execute (client, ban) {
    db.incrementActivityStat(ban.guild.id, 'leaves')

    const embed = new EmbedBuilder()
      .setColor(COLORS.error)
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'User',   value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Reason', value: ban.reason ?? 'No reason',              inline: true }
      )
      .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
      .setTimestamp()

    await sendLog(client, ban.guild.id, 'ban', { embeds: [embed] })
  }
}
