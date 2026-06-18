'use strict'

const { EmbedBuilder } = require('discord.js')
const { sendLog }      = require('../../shared/logRouter')
const { COLORS }       = require('../../shared/embed')

module.exports = {
  name: 'guildBanRemove',
  async execute (client, ban) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle('✅ Member Unbanned')
      .addFields({ name: 'User', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true })
      .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
      .setTimestamp()

    await sendLog(client, ban.guild.id, 'unban', { embeds: [embed] })
  }
}
