'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const safeRegex  = require('safe-regex')
const db         = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { formatDuration, parseDuration } = require('../../../shared/utils')

const TRIGGER_TYPES = ['spam', 'mentions', 'links', 'invites', 'words', 'caps', 'newlines', 'emoji', 'regex']
const ACTIONS       = ['delete', 'warn', 'mute', 'kick', 'ban']

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage automod rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add an automod rule')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger type').setRequired(true)
        .addChoices(...TRIGGER_TYPES.map(t => ({ name: t, value: t }))))
      .addStringOption(o => o.setName('action').setDescription('Action to take').setRequired(true)
        .addChoices(...ACTIONS.map(a => ({ name: a, value: a }))))
      .addIntegerOption(o => o.setName('threshold').setDescription('Trigger count (for spam/mentions/etc)').setRequired(false))
      .addIntegerOption(o => o.setName('window').setDescription('Window in seconds').setRequired(false))
      .addStringOption(o => o.setName('duration').setDescription('Punishment duration e.g. 10m').setRequired(false))
      .addStringOption(o => o.setName('words').setDescription('Comma-separated word list (for words/regex trigger)').setRequired(false))
      .addStringOption(o => o.setName('ignore_roles').setDescription('Comma-separated role IDs to ignore').setRequired(false))
      .addStringOption(o => o.setName('ignore_channels').setDescription('Comma-separated channel IDs to ignore').setRequired(false)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all automod rules'))

    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('Enable or disable a rule')
      .addIntegerOption(o => o.setName('id').setDescription('Rule ID').setRequired(true)))

    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete a rule')
      .addIntegerOption(o => o.setName('id').setDescription('Rule ID').setRequired(true)))

    .addSubcommand(s => s
      .setName('edit')
      .setDescription('Edit an existing automod rule')
      .addIntegerOption(o => o.setName('id').setDescription('Rule ID').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('New action').setRequired(false)
        .addChoices(...ACTIONS.map(a => ({ name: a, value: a }))))
      .addIntegerOption(o => o.setName('threshold').setDescription('New threshold').setRequired(false))
      .addIntegerOption(o => o.setName('window').setDescription('New window in seconds').setRequired(false))
      .addStringOption(o => o.setName('duration').setDescription('New punishment duration').setRequired(false))
      .addStringOption(o => o.setName('words').setDescription('New word list (comma-separated)').setRequired(false)))

    .addSubcommand(s => s
      .setName('ignore')
      .setDescription('Add/remove a role or channel bypass for a rule')
      .addIntegerOption(o => o.setName('id').setDescription('Rule ID').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Role or channel').setRequired(true)
        .addChoices({ name: 'Role', value: 'role' }, { name: 'Channel', value: 'channel' }))
      .addStringOption(o => o.setName('target_id').setDescription('Role or channel ID').setRequired(true))
      .addBooleanOption(o => o.setName('remove').setDescription('Remove from ignore list').setRequired(false)))

    .addSubcommand(s => s
      .setName('test')
      .setDescription('Test a message against all active automod rules')
      .addStringOption(o => o.setName('text').setDescription('Text to test').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    // ── add ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const trigger   = interaction.options.getString('trigger')
      const action    = interaction.options.getString('action')
      const threshold = interaction.options.getInteger('threshold') ?? null
      const window    = interaction.options.getInteger('window') ?? 10
      const durStr    = interaction.options.getString('duration')
      const wordsRaw  = interaction.options.getString('words') ?? ''
      const ignRoles  = interaction.options.getString('ignore_roles') ?? ''
      const ignChans  = interaction.options.getString('ignore_channels') ?? ''

      const wordList = wordsRaw ? wordsRaw.split(',').map(w => w.trim()).filter(Boolean) : []
      if (trigger === 'regex') {
        for (const pattern of wordList) {
          if (!safeRegex(pattern)) {
            return interaction.editReply({ embeds: [error('Unsafe regex', `Pattern \`${pattern}\` is unsafe (ReDoS risk).`)] })
          }
          try { new RegExp(pattern) } catch {
            return interaction.editReply({ embeds: [error('Invalid regex', `Pattern \`${pattern}\` is not valid regex.`)] })
          }
        }
      }

      let duration = null
      if (durStr) {
        duration = parseDuration(durStr)
        if (!duration) return interaction.editReply({ embeds: [error('Invalid duration', 'Use e.g. `10m`, `1h`, `7d`.')] })
      }

      const ignoreRoles    = ignRoles ? ignRoles.split(',').map(r => r.trim().replace(/\D/g, '')).filter(Boolean) : []
      const ignoreChannels = ignChans ? ignChans.split(',').map(c => c.trim().replace(/\D/g, '')).filter(Boolean) : []

      const ruleId = db.createAutomodRule(
        guildId, trigger, threshold, window, action, duration,
        ignoreRoles, ignoreChannels, wordList
      )

      return interaction.editReply({
        embeds: [success('Rule Added', `Automod rule **#${ruleId}** created.\n**Trigger:** \`${trigger}\` → **Action:** \`${action}\``)]
      })
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const rules = db.getAllAutomodRules(guildId)
      if (!rules.length) return interaction.editReply({ content: 'No automod rules configured.' })

      const embed = info('🛡️ Automod Rules', null)
      for (const r of rules) {
        const status = r.enabled ? '🟢' : '🔴'
        const dur    = r.duration    ? ` | Duration: ${formatDuration(r.duration)}`          : ''
        const thresh = r.threshold   ? ` | Threshold: ${r.threshold}/${r.window_secs}s`      : ''
        embed.addFields({
          name:  `${status} #${r.id} — ${r.trigger_type} → ${r.action}`,
          value: `${thresh}${dur}` || 'No extra config',
          inline: false
        })
      }
      return interaction.editReply({ embeds: [embed] })
    }

    // ── toggle ────────────────────────────────────────────────────────────────
    if (sub === 'toggle') {
      const ruleId = interaction.options.getInteger('id')
      const rules  = db.getAllAutomodRules(guildId)
      const rule   = rules.find(r => r.id === ruleId)
      if (!rule) return interaction.editReply({ embeds: [error('Not found', `Rule #${ruleId} not found.`)] })

      db.toggleAutomodRule(ruleId, guildId)
      const newState = rule.enabled ? 'disabled' : 'enabled'
      return interaction.editReply({ embeds: [success('Rule Toggled', `Rule **#${ruleId}** is now **${newState}**.`)] })
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const ruleId = interaction.options.getInteger('id')
      db.deleteAutomodRule(ruleId, guildId)
      return interaction.editReply({ embeds: [success('Rule Deleted', `Rule **#${ruleId}** deleted.`)] })
    }

    // ── edit ──────────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const ruleId = interaction.options.getInteger('id')
      const rules  = db.getAllAutomodRules(guildId)
      const rule   = rules.find(r => r.id === ruleId)
      if (!rule) return interaction.editReply({ embeds: [error('Not found', `Rule #${ruleId} not found.`)] })

      const fields    = {}
      const action    = interaction.options.getString('action')
      const threshold = interaction.options.getInteger('threshold')
      const window    = interaction.options.getInteger('window')
      const durStr    = interaction.options.getString('duration')
      const wordsRaw  = interaction.options.getString('words')

      if (action)    fields.action      = action
      if (threshold) fields.threshold   = threshold
      if (window)    fields.window_secs = window
      if (wordsRaw)  fields.word_list   = JSON.stringify(wordsRaw.split(',').map(w => w.trim()).filter(Boolean))
      if (durStr) {
        const secs = parseDuration(durStr)
        if (!secs) return interaction.editReply({ embeds: [error('Invalid duration', 'Use e.g. `10m`, `1h`.')] })
        fields.duration = secs
      }

      if (!Object.keys(fields).length) {
        return interaction.editReply({ embeds: [error('Nothing changed', 'Provide at least one field to update.')] })
      }

      db.updateAutomodRule(ruleId, guildId, fields)
      return interaction.editReply({ embeds: [success('Rule Updated', `Rule **#${ruleId}** updated.`)] })
    }

    // ── ignore ────────────────────────────────────────────────────────────────
    if (sub === 'ignore') {
      const ruleId   = interaction.options.getInteger('id')
      const type     = interaction.options.getString('type')
      const targetId = interaction.options.getString('target_id').replace(/\D/g, '')
      const remove   = interaction.options.getBoolean('remove') ?? false

      const rules = db.getAllAutomodRules(guildId)
      const rule  = rules.find(r => r.id === ruleId)
      if (!rule) return interaction.editReply({ embeds: [error('Not found', `Rule #${ruleId} not found.`)] })

      if (type === 'role') {
        const arr     = safeParseArray(rule.ignore_roles)
        const updated = remove ? arr.filter(r => r !== targetId) : [...new Set([...arr, targetId])]
        db.updateAutomodRule(ruleId, guildId, { ignore_roles: JSON.stringify(updated) })
        return interaction.editReply({ embeds: [success('Updated', `<@&${targetId}> ${remove ? 'removed from' : 'added to'} ignore list for rule **#${ruleId}**.`)] })
      }

      if (type === 'channel') {
        const arr     = safeParseArray(rule.ignore_channels)
        const updated = remove ? arr.filter(c => c !== targetId) : [...new Set([...arr, targetId])]
        db.updateAutomodRule(ruleId, guildId, { ignore_channels: JSON.stringify(updated) })
        return interaction.editReply({ embeds: [success('Updated', `<#${targetId}> ${remove ? 'removed from' : 'added to'} ignore list for rule **#${ruleId}**.`)] })
      }
    }

    // ── test ──────────────────────────────────────────────────────────────────
    if (sub === 'test') {
      const text  = interaction.options.getString('text')
      const rules = db.getAutomodRules(guildId)

      if (!rules.length) return interaction.editReply({ content: 'No active automod rules to test against.' })

      const { detectTrigger } = require('../../events/automod/automodEngine')
      const hits = []

      for (const rule of rules) {
        const fakeMsg = {
          content: text,
          guild:   interaction.guild,
          author:  interaction.user,
          member:  interaction.member,
          channel: interaction.channel
        }
        try {
          if (detectTrigger(rule, fakeMsg)) {
            hits.push(`**#${rule.id}** — \`${rule.trigger_type}\` → \`${rule.action}\``)
          }
        } catch {}
      }

      if (!hits.length) {
        return interaction.editReply({ embeds: [success('No Match', 'That text does not trigger any active automod rules.')] })
      }

      return interaction.editReply({
        embeds: [error('Rules Triggered', `The following rules **would fire** on that text:\n${hits.join('\n')}`)]
      })
    }
  }
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}