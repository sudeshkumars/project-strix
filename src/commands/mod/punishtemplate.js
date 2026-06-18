'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db = require('../../../shared/db')
const { successCard, errorCard, infoCard, modCard, capList } = require('../../../shared/components')
const { parseDuration, formatDuration, safeSend } = require('../../../shared/utils')
const { modDm } = require('../../../shared/embed')

const VALID_TYPES = ['warn', 'mute', 'kick', 'ban', 'tempban']

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('punish')
    .setDescription('Manage and execute punishment templates')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a punishment template')
      .addStringOption(o => o.setName('name').setDescription('Template name (max 32 chars)').setMaxLength(32).setRequired(true))
      .addStringOption(o => o.setName('actions').setDescription('JSON array of actions').setRequired(true)))
    .addSubcommand(s => s
      .setName('execute')
      .setDescription('Execute a template on a user')
      .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true))
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all punishment templates'))
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete a punishment template')
      .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('info')
      .setDescription('View template details')
      .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true))),

  async autocomplete (client, interaction) {
    const focused   = interaction.options.getFocused().toLowerCase()
    const templates = db.getPunishTemplates(interaction.guild.id)
    const filtered  = templates
      .filter(t => t.name.toLowerCase().includes(focused))
      .slice(0, 25)
    await interaction.respond(filtered.map(t => ({ name: t.name, value: t.name })))
  },

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'create') {
      const name       = interaction.options.getString('name')
      const actionsRaw = interaction.options.getString('actions')

      let actions
      try {
        actions = JSON.parse(actionsRaw)
      } catch {
        return interaction.editReply(errorCard('Invalid JSON', ['Could not parse the actions JSON. Ensure it is a valid JSON array.']))
      }

      if (!Array.isArray(actions) || actions.length === 0) {
        return interaction.editReply(errorCard('Invalid Actions', ['Actions must be a non-empty JSON array.']))
      }

      for (const action of actions) {
        if (!action.type || !VALID_TYPES.includes(action.type)) {
          return interaction.editReply(errorCard('Invalid Action Type', [
            `\`${action.type || 'undefined'}\` is not valid.`,
            `Supported: ${VALID_TYPES.join(', ')}`
          ]))
        }
      }

      const existing = db.getPunishTemplate(guildId, name)
      if (existing) {
        return interaction.editReply(errorCard('Already Exists', [`A template named **${name}** already exists.`]))
      }

      db.createPunishTemplate(guildId, name, actions, interaction.user.id)
      return interaction.editReply(successCard('Template Created', [
        `**${name}** created with **${actions.length}** action(s).`
      ]))
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name')
      const tmpl = db.getPunishTemplate(guildId, name)
      if (!tmpl) {
        return interaction.editReply(errorCard('Not Found', [`No template named **${name}** exists.`]))
      }
      db.deletePunishTemplate(guildId, name)
      return interaction.editReply(successCard('Deleted', [`Template **${name}** has been deleted.`]))
    }

    if (sub === 'list') {
      const templates = db.getPunishTemplates(guildId)
      if (!templates.length) {
        return interaction.editReply(infoCard('Punishment Templates', ['No templates configured.']))
      }

      const lines = capList(templates, 15, t => {
        const actions = JSON.parse(t.actions)
        return `**${t.name}** - ${actions.length} action(s)`
      })
      return interaction.editReply(infoCard('Punishment Templates', lines))
    }

    if (sub === 'info') {
      const name = interaction.options.getString('name')
      const tmpl = db.getPunishTemplate(guildId, name)
      if (!tmpl) {
        return interaction.editReply(errorCard('Not Found', [`No template named **${name}** exists.`]))
      }

      const actions = JSON.parse(tmpl.actions)
      const lines = actions.map((a, i) => {
        let desc = `${i + 1}. **${a.type}**`
        if (a.reason) desc += ` - ${a.reason}`
        if (a.duration) desc += ` (${a.duration})`
        if (a.points) desc += ` [${a.points}pts]`
        if (a.delete_days) desc += ` [del ${a.delete_days}d]`
        return desc
      })

      return interaction.editReply(infoCard(`Template: ${name}`, lines, {
        subtext: `Created by <@${tmpl.created_by}>`
      }))
    }

    if (sub === 'execute') {
      const name   = interaction.options.getString('name')
      const target = interaction.options.getUser('user')
      const guild  = interaction.guild
      const config = interaction.guildConfig

      const tmpl = db.getPunishTemplate(guildId, name)
      if (!tmpl) {
        return interaction.editReply(errorCard('Not Found', [`No template named **${name}** exists.`]))
      }

      let member
      try { member = await guild.members.fetch(target.id) } catch {
        return interaction.editReply(errorCard('Member Not Found', ['Could not find the specified member in this server.']))
      }

      if (member.id === interaction.user.id) {
        return interaction.editReply(errorCard('Invalid Target', ['You cannot execute a punishment template on yourself.']))
      }

      const actions = JSON.parse(tmpl.actions)
      const results = []

      for (const action of actions) {
        try {
          const result = await executeAction(action, member, interaction, config, guild)
          results.push(result)
        } catch (err) {
          results.push(`Failed: ${action.type} - ${err.message}`)
        }
      }

      const lines = [
        `**Target:** ${target.tag || target.username}`,
        `**Template:** ${name}`,
        `**Actions:** ${actions.length}`,
        '',
        ...results
      ]

      const payload = modCard('Punishment Executed', lines)

      if (config?.case_channel) {
        const ch = guild.channels.cache.get(config.case_channel)
        if (ch) await safeSend(ch, payload)
      }

      return interaction.editReply(payload)
    }
  }
}

async function executeAction (action, member, interaction, config, guild) {
  const mod    = interaction.user
  const target = member.user
  const reason = action.reason || 'Punishment template'

  switch (action.type) {
    case 'warn': {
      const points = action.points || 1
      const caseId = db.createCase(guild.id, target.id, mod.id, 'warn', reason)
      db.createWarning(guild.id, target.id, mod.id, reason, points, caseId)
      if (config?.dm_on_action) {
        await safeSend(target, { embeds: [modDm({ action: 'Warn', guildName: guild.name, reason })] })
      }
      return `Warn: ${reason} (${points}pts) [Case #${caseId}]`
    }

    case 'mute': {
      const durationSecs = parseDuration(action.duration)
      if (!durationSecs) return 'Mute: skipped (invalid duration)'
      const ms = durationSecs * 1000
      await member.timeout(ms, reason)
      const expiresAt = Math.floor(Date.now() / 1000) + durationSecs
      const caseId = db.createCase(guild.id, target.id, mod.id, 'mute', reason, expiresAt)
      db.createTempPunishment(guild.id, target.id, 'mute', expiresAt, caseId)
      if (config?.dm_on_action) {
        await safeSend(target, { embeds: [modDm({ action: 'Mute', guildName: guild.name, reason, duration: action.duration })] })
      }
      return `Mute: ${action.duration} - ${reason} [Case #${caseId}]`
    }

    case 'kick': {
      if (config?.dm_on_action) {
        await safeSend(target, { embeds: [modDm({ action: 'Kick', guildName: guild.name, reason })] })
      }
      await member.kick(reason)
      const caseId = db.createCase(guild.id, target.id, mod.id, 'kick', reason)
      return `Kick: ${reason} [Case #${caseId}]`
    }

    case 'ban': {
      const deleteDays = action.delete_days || 0
      if (config?.dm_on_action) {
        await safeSend(target, { embeds: [modDm({ action: 'Ban', guildName: guild.name, reason })] })
      }
      await guild.members.ban(target.id, { reason, deleteMessageDays: deleteDays })
      let expiresAt = null
      if (action.duration) {
        const secs = parseDuration(action.duration)
        if (secs) expiresAt = Math.floor(Date.now() / 1000) + secs
      }
      const caseId = db.createCase(guild.id, target.id, mod.id, 'ban', reason, expiresAt)
      if (expiresAt) db.createTempPunishment(guild.id, target.id, 'ban', expiresAt, caseId)
      return `Ban: ${reason}${action.duration ? ` (${action.duration})` : ''} [Case #${caseId}]`
    }

    case 'tempban': {
      const deleteDays = action.delete_days || 0
      const durationSecs = parseDuration(action.duration)
      if (!durationSecs) return 'Tempban: skipped (invalid duration)'
      if (config?.dm_on_action) {
        await safeSend(target, { embeds: [modDm({ action: 'Tempban', guildName: guild.name, reason, duration: action.duration })] })
      }
      await guild.members.ban(target.id, { reason, deleteMessageDays: deleteDays })
      const expiresAt = Math.floor(Date.now() / 1000) + durationSecs
      const caseId = db.createCase(guild.id, target.id, mod.id, 'tempban', reason, expiresAt)
      db.createTempPunishment(guild.id, target.id, 'ban', expiresAt, caseId)
      return `Tempban: ${action.duration} - ${reason} [Case #${caseId}]`
    }

    default:
      return `Unknown action: ${action.type}`
  }
}
