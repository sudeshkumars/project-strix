'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db           = require('../../../shared/db')
const { infoCard } = require('../../../shared/components')
const os           = require('os')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('botstats')
    .setDescription('View bot statistics (owner only)'),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const guilds   = client.guilds.cache.size
    const users    = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)
    const commands = client.commands.size
    const uptime   = formatUptime(client.uptime)
    const memMB    = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)
    const cpuLoad  = os.loadavg()[0].toFixed(2)

    const stats = db.getBotStats(7)
    const totalCmds  = stats.reduce((a, b) => a + (b.commands_fired ?? 0), 0)
    const totalJoins = stats.reduce((a, b) => a + (b.joins ?? 0), 0)

    const lines = [
      `**Guilds** \u2014 ${guilds}`,
      `**Users** \u2014 ${users}`,
      `**Commands** \u2014 ${commands}`,
      `**Uptime** \u2014 ${uptime}`,
      `**Memory** \u2014 ${memMB} MB`,
      `**CPU Load** \u2014 ${cpuLoad}`,
      `**Node.js** \u2014 ${process.version}`,
      `**7d Cmds** \u2014 ${totalCmds}`,
      `**7d Joins** \u2014 ${totalJoins}`
    ]

    await interaction.editReply(infoCard('\u{1f4ca} Bot Stats', lines, {
      subtext: `Shard: ${client.shard?.ids?.[0] ?? 0}`
    }))
  }
}

function formatUptime (ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ')
}
