'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const safeRegex                = require('safe-regex')
const db                       = require('../../../shared/db')
const { successCard, errorCard, infoCard, capList } = require('../../../shared/components')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('autoresponse')
    .setDescription('Automatic keyword responses (fire on message, no command needed)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add an auto-response')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger word/phrase or regex').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('response').setDescription('Response text').setRequired(true).setMaxLength(2000))
      .addBooleanOption(o => o.setName('regex').setDescription('Treat trigger as regex').setRequired(false))
      .addBooleanOption(o => o.setName('exact').setDescription('Match exact message only (not substring)').setRequired(false))
      .addStringOption(o => o.setName('channels').setDescription('Comma-separated channel IDs (blank = all)').setRequired(false)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all auto-responses')
      .addIntegerOption(o => o.setName('page').setDescription('Page').setMinValue(1).setRequired(false)))

    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete an auto-response')
      .addIntegerOption(o => o.setName('id').setDescription('Auto-response ID').setRequired(true)))

    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('Enable or disable an auto-response')
      .addIntegerOption(o => o.setName('id').setDescription('Auto-response ID').setRequired(true)))

    .addSubcommand(s => s
      .setName('test')
      .setDescription('Test a message against all auto-responses')
      .addStringOption(o => o.setName('text').setDescription('Text to test').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'add') {
      const trigger  = interaction.options.getString('trigger')
      const response = interaction.options.getString('response')
      const regex    = interaction.options.getBoolean('regex') ?? false
      const exact    = interaction.options.getBoolean('exact') ?? false
      const chansRaw = interaction.options.getString('channels') ?? ''
      const channels = chansRaw ? chansRaw.split(',').map(c => c.trim().replace(/\D/g, '')).filter(Boolean) : []

      if (regex) {
        if (!safeRegex(trigger)) {
          return interaction.editReply(errorCard('Unsafe regex', [`Pattern \`${trigger}\` is unsafe (ReDoS risk).`]))
        }
        try { new RegExp(trigger) } catch {
          return interaction.editReply(errorCard('Invalid regex', [`\`${trigger}\` is not valid regex.`]))
        }
      }

      const id = db.getDb().prepare(`
        INSERT INTO custom_commands (guild_id, trigger, response, type, perm_level, regex, channel_scope, created_at)
        VALUES (?, ?, ?, 'autoresponse', ?, ?, ?, ?)
      `).run(guildId, trigger, response, exact ? 'exact' : 'substring', regex ? 1 : 0, JSON.stringify(channels), Math.floor(Date.now() / 1000)).lastInsertRowid

      return interaction.editReply(successCard('Auto-Response Added', [`**#${id}** \u2014 \`${trigger}\` will now auto-respond.`]))
    }

    if (sub === 'list') {
      const page = (interaction.options.getInteger('page') ?? 1) - 1
      const rows = db.getDb().prepare(`
        SELECT * FROM custom_commands WHERE guild_id = ? AND type = 'autoresponse'
        ORDER BY id DESC LIMIT 10 OFFSET ?
      `).all(guildId, page * 10)

      if (!rows.length) return interaction.editReply(infoCard('\u{1f916} Auto-Responses', ['No auto-responses configured.']))

      const lines = rows.map(r =>
        `**#${r.id}** \u2014 \`${r.trigger}\` ${r.regex ? '(regex)' : ''} ${r.perm_level === 'exact' ? '(exact)' : ''}\n> ${r.response.slice(0, 80)}${r.response.length > 80 ? '\u2026' : ''}`
      )

      return interaction.editReply(infoCard(`\u{1f916} Auto-Responses (page ${page + 1})`, lines))
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id')
      db.getDb().prepare(`DELETE FROM custom_commands WHERE id = ? AND guild_id = ? AND type = 'autoresponse'`).run(id, guildId)
      return interaction.editReply(successCard('Deleted', [`Auto-response **#${id}** deleted.`]))
    }

    if (sub === 'toggle') {
      const id  = interaction.options.getInteger('id')
      const row = db.getDb().prepare(`SELECT * FROM custom_commands WHERE id = ? AND guild_id = ? AND type = 'autoresponse'`).get(id, guildId)
      if (!row) return interaction.editReply(errorCard('Not found', [`Auto-response #${id} not found.`]))

      const newState = row.cooldown === 1 ? 0 : 1
      db.getDb().prepare(`UPDATE custom_commands SET cooldown = ? WHERE id = ?`).run(newState, id)
      return interaction.editReply(successCard('Toggled', [`Auto-response **#${id}** is now **${newState ? 'enabled' : 'disabled'}**.`]))
    }

    if (sub === 'test') {
      const text = interaction.options.getString('text')
      const rows = db.getDb().prepare(`
        SELECT * FROM custom_commands WHERE guild_id = ? AND type = 'autoresponse' AND cooldown != 1
      `).all(guildId)

      if (!rows.length) return interaction.editReply(infoCard('Test', ['No active auto-responses.']))

      const hits = []
      for (const r of rows) {
        const matched = r.regex
          ? (() => { try { return new RegExp(r.trigger, 'i').test(text) } catch { return false } })()
          : r.perm_level === 'exact'
            ? text.toLowerCase() === r.trigger.toLowerCase()
            : text.toLowerCase().includes(r.trigger.toLowerCase())

        if (matched) hits.push(`**#${r.id}** \u2014 \`${r.trigger}\` \u2192 ${r.response.slice(0, 60)}\u2026`)
      }

      if (!hits.length) return interaction.editReply(successCard('No Match', ['No auto-responses would fire on that text.']))
      return interaction.editReply(infoCard('Matches', hits))
    }
  }
}
