'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { info }                = require('../../../shared/embed')
const { fullTime }            = require('../../../shared/utils')

module.exports = {
  permLevel: 'user',
  guildOnly: false,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('View how long the bot has been online'),

  async execute (client, interaction) {
    const uptimeMs   = client.uptime ?? 0
    const startedAt  = Math.floor((Date.now() - uptimeMs) / 1000)

    const embed = info('⏱️ Uptime', null)
      .addFields(
        { name: 'Online Since', value: fullTime(startedAt),      inline: true },
        { name: 'Duration',     value: formatUptime(uptimeMs),   inline: true },
        { name: 'WebSocket',    value: `${client.ws.ping}ms`,    inline: true }
      )
      .setTimestamp()

    await interaction.reply({ embeds: [embed], ephemeral: false })
  }
}

function formatUptime (ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [
    d   && `${d}d`,
    h   && `${h}h`,
    m   && `${m}m`,
    `${sec}s`
  ].filter(Boolean).join(' ')
}
