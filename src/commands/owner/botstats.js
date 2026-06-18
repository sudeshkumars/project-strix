'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db       = require('../../../shared/db')
const { info } = require('../../../shared/embed')
const os       = require('os')

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

    const embed = info('📊 Bot Stats', null)
      .addFields(
        { name: 'Guilds',    value: String(guilds),   inline: true },
        { name: 'Users',     value: String(users),    inline: true },
        { name: 'Commands',  value: String(commands), inline: true },
        { name: 'Uptime',    value: uptime,           inline: true },
        { name: 'Memory',    value: `${memMB} MB`,    inline: true },
        { name: 'CPU Load',  value: cpuLoad,          inline: true },
        { name: 'Node.js',   value: process.version,  inline: true },
        { name: '7d Cmds',   value: String(totalCmds),  inline: true },
        { name: '7d Joins',  value: String(totalJoins), inline: true }
      )
      .setFooter({ text: `Shard: ${client.shard?.ids?.[0] ?? 0}` })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  }
}

function formatUptime (ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ')
}
