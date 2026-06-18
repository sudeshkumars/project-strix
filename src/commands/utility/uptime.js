'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { infoCard }            = require('../../../shared/components')
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

    await interaction.reply(infoCard('\u23f1\ufe0f Uptime', [
      `**Online Since** \u2014 ${fullTime(startedAt)}`,
      `**Duration** \u2014 ${formatUptime(uptimeMs)}`,
      `**WebSocket** \u2014 ${client.ws.ping}ms`
    ]))
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
