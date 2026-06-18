'use strict'

const { SlashCommandBuilder, ActivityType } = require('discord.js')
const { success, error, info } = require('../../../shared/embed')
const db = require('../../../shared/db')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('botconfig')
    .setDescription('Global bot configuration (owner only)')
    .addSubcommand(s => s
      .setName('status')
      .setDescription('Set bot activity status')
      .addStringOption(o => o.setName('type').setDescription('Activity type').setRequired(true)
        .addChoices(
          { name: 'Playing',   value: 'PLAYING'   },
          { name: 'Watching',  value: 'WATCHING'  },
          { name: 'Listening', value: 'LISTENING' },
          { name: 'Competing', value: 'COMPETING' }
        ))
      .addStringOption(o => o.setName('text').setDescription('Activity text').setRequired(true)))
    .addSubcommand(s => s
      .setName('presence')
      .setDescription('Set bot online presence')
      .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true)
        .addChoices(
          { name: 'Online',    value: 'online'    },
          { name: 'Idle',      value: 'idle'      },
          { name: 'DND',       value: 'dnd'       },
          { name: 'Invisible', value: 'invisible' }
        )))
    .addSubcommand(s => s
      .setName('stats')
      .setDescription('View global bot stats'))
    .addSubcommand(s => s
      .setName('dbstats')
      .setDescription('View database stats')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub = interaction.options.getSubcommand()

    if (sub === 'status') {
      const type = interaction.options.getString('type')
      const text = interaction.options.getString('text')

      const typeMap = {
        PLAYING:   ActivityType.Playing,
        LISTENING: ActivityType.Listening,
        WATCHING:  ActivityType.Watching,
        COMPETING: ActivityType.Competing
      }

      client.user.setActivity(text, { type: typeMap[type] ?? ActivityType.Playing })
      return interaction.editReply({ embeds: [success('Status Set', `Bot is now **${type}** ${text}`)] })
    }

    if (sub === 'presence') {
      const status = interaction.options.getString('status')
      client.user.setStatus(status)
      return interaction.editReply({ embeds: [success('Presence Set', `Status set to **${status}**.`)] })
    }

    if (sub === 'stats') {
      const guilds   = client.guilds.cache.size
      const users    = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)
      const cmds     = client.commands.size
      const uptime   = formatUptime(client.uptime)
      const mem      = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)
      const stats7   = db.getBotStats(7)
      const fired7   = stats7.reduce((a, b) => a + (b.commands_fired ?? 0), 0)

      const embed = info('📊 Global Bot Stats', null)
        .addFields(
          { name: 'Guilds',   value: String(guilds),   inline: true },
          { name: 'Users',    value: String(users),    inline: true },
          { name: 'Commands', value: String(cmds),     inline: true },
          { name: 'Uptime',   value: uptime,           inline: true },
          { name: 'Memory',   value: `${mem} MB`,      inline: true },
          { name: 'Node',     value: process.version,  inline: true },
          { name: '7d Cmds',  value: String(fired7),   inline: true }
        )
      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'dbstats') {
      const tables = [
        'guilds','users','cases','warnings','tickets',
        'automod_rules','custom_commands','scheduled_messages',
        'role_panels','giveaways','highlights'
      ]

      const embed = info('🗄️ Database Stats', null)
      for (const t of tables) {
        try {
          const row = db.getDb().prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()
          embed.addFields({ name: t, value: String(row.c), inline: true })
        } catch {}
      }
      return interaction.editReply({ embeds: [embed] })
    }
  }
}

function formatUptime (ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ')
}
