'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const cron                     = require('node-cron')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { relativeTime }         = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule recurring messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a scheduled message')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addStringOption(o => o.setName('cron').setDescription('Cron expression e.g. "0 9 * * 1"').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message content').setRequired(false))
      .addStringOption(o => o.setName('embed_title').setDescription('Embed title').setRequired(false))
      .addStringOption(o => o.setName('embed_body').setDescription('Embed body').setRequired(false)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List scheduled messages'))
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('Enable/disable a schedule')
      .addIntegerOption(o => o.setName('id').setDescription('Schedule ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete a schedule')
      .addIntegerOption(o => o.setName('id').setDescription('Schedule ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('test')
      .setDescription('Fire a scheduled message immediately as a preview')
      .addIntegerOption(o => o.setName('id').setDescription('Schedule ID').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'add') {
      const channel    = interaction.options.getChannel('channel')
      const cronExpr   = interaction.options.getString('cron').trim()
      const content    = interaction.options.getString('message') ?? null
      const embedTitle = interaction.options.getString('embed_title') ?? null
      const embedBody  = interaction.options.getString('embed_body') ?? null

      if (!cron.validate(cronExpr)) {
        return interaction.editReply({ embeds: [error('Invalid cron', `\`${cronExpr}\` is not valid.\nExample: \`0 9 * * 1\` = every Monday 9am UTC`)] })
      }
      if (!content && !embedTitle) {
        return interaction.editReply({ embeds: [error('No content', 'Provide a message or embed title.')] })
      }

      const embed = embedTitle ? { title: embedTitle, description: embedBody ?? '' } : null
      const id    = db.createScheduledMessage(guildId, channel.id, content, embed, cronExpr)

      return interaction.editReply({
        embeds: [success('Scheduled', `Message **#${id}** scheduled.\n**Cron:** \`${cronExpr}\`\n**Channel:** ${channel}`)]
      })
    }

    if (sub === 'list') {
      const msgs = db.getScheduledMessages(guildId)
      if (!msgs.length) return interaction.editReply({ content: 'No scheduled messages.' })

      const embed = info('🕐 Scheduled Messages', null)
      for (const m of msgs) {
        const preview = m.content
          ? m.content.slice(0, 60)
          : (m.embed ? JSON.parse(m.embed).title ?? '(embed)' : '(embed)')
        embed.addFields({
          name:  `#${m.id} — \`${m.cron}\` → <#${m.channel_id}>`,
          value: `${m.enabled ? '🟢' : '🔴'} ${preview}${m.last_run ? ` | Last: ${relativeTime(m.last_run)}` : ''}`,
          inline: false
        })
      }
      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'toggle') {
      const id   = interaction.options.getInteger('id')
      const rows = db.getAllScheduledMessages()
      const msg  = rows.find(m => m.id === id && m.guild_id === guildId)
      if (!msg) return interaction.editReply({ embeds: [error('Not found', `Schedule #${id} not found.`)] })

      db.updateScheduledMessage(id, guildId, { enabled: msg.enabled ? 0 : 1 })
      return interaction.editReply({
        embeds: [success('Toggled', `Schedule **#${id}** is now **${msg.enabled ? 'disabled' : 'enabled'}**.`)]
      })
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id')
      db.deleteScheduledMessage(id, guildId)
      return interaction.editReply({ embeds: [success('Deleted', `Schedule **#${id}** deleted.`)] })
    }

    if (sub === 'test') {
      const id   = interaction.options.getInteger('id')
      const rows = db.getAllScheduledMessages()
      const msg  = rows.find(m => m.id === id && m.guild_id === guildId)
      if (!msg) return interaction.editReply({ embeds: [error('Not found', `Schedule #${id} not found.`)] })

      const { EmbedBuilder } = require('discord.js')
      const channel = interaction.guild.channels.cache.get(msg.channel_id)
      if (!channel) return interaction.editReply({ embeds: [error('Channel missing', 'The target channel no longer exists.')] })

      const payload = {}
      if (msg.content) payload.content = msg.content
      if (msg.embed) {
        try {
          const data = JSON.parse(msg.embed)
          const e = new EmbedBuilder().setColor(data.color ?? 0x5865F2)
          if (data.title)       e.setTitle(data.title)
          if (data.description) e.setDescription(data.description)
          payload.embeds = [e]
        } catch {}
      }

      try { await channel.send(payload) } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }

      return interaction.editReply({ embeds: [success('Test Fired', `Schedule **#${id}** sent to ${channel}.`)] })
    }
  }
}
