'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { infoCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and uptime'),

  async execute (client, interaction) {
    const sent = await interaction.reply({ content: '\u{1f3d3} Pinging...', fetchReply: true })

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp
    const ws        = client.ws.ping
    const uptime    = formatUptime(client.uptime)

    await interaction.editReply(infoCard('\u{1f3d3} Pong!', [
      `**Roundtrip** \u2014 ${roundtrip}ms`,
      `**WebSocket** \u2014 ${ws}ms`,
      `**Uptime** \u2014 ${uptime}`
    ]))
  }
}

function formatUptime (ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ')
}
