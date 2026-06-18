'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'user',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and uptime'),

  async execute (client, interaction) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true })

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp
    const ws        = client.ws.ping
    const uptime    = formatUptime(client.uptime)

    const embed = info('🏓 Pong!', null)
      .addFields(
        { name: 'Roundtrip', value: `${roundtrip}ms`, inline: true },
        { name: 'WebSocket', value: `${ws}ms`,        inline: true },
        { name: 'Uptime',    value: uptime,            inline: true }
      )

    await interaction.editReply({ content: null, embeds: [embed] })
  }
}

function formatUptime (ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ')
}
