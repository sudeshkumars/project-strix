'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }         = require('../../../shared/cache')
const { success, error, info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Server configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('prefix')
      .setDescription('Set the bot prefix')
      .addStringOption(o => o.setName('prefix').setDescription('New prefix').setRequired(true).setMaxLength(5)))
    .addSubcommand(s => s
      .setName('modrole')
      .setDescription('Add/remove a mod role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .addBooleanOption(o => o.setName('remove').setDescription('Remove instead').setRequired(false)))
    .addSubcommand(s => s
      .setName('adminrole')
      .setDescription('Add/remove an admin role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .addBooleanOption(o => o.setName('remove').setDescription('Remove instead').setRequired(false)))
    .addSubcommand(s => s
      .setName('logchannel')
      .setDescription('Set the log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s
      .setName('modchannel')
      .setDescription('Set the mod channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s
      .setName('casechannel')
      .setDescription('Set the case log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s
      .setName('suggestions')
      .setDescription('Set the suggestions channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s
      .setName('xp')
      .setDescription('Configure XP settings')
      .addIntegerOption(o => o.setName('min').setDescription('Min XP per message').setMinValue(1).setMaxValue(100).setRequired(false))
      .addIntegerOption(o => o.setName('max').setDescription('Max XP per message').setMinValue(1).setMaxValue(100).setRequired(false))
      .addIntegerOption(o => o.setName('cooldown').setDescription('XP cooldown seconds').setMinValue(10).setMaxValue(3600).setRequired(false))
      .addChannelOption(o => o.setName('levelup_channel').setDescription('Level-up channel').setRequired(false)))
    .addSubcommand(s => s
      .setName('warnings')
      .setDescription('Configure warning settings')
      .addIntegerOption(o => o.setName('threshold').setDescription('Warn point threshold').setMinValue(1).setRequired(false))
      .addIntegerOption(o => o.setName('decay_days').setDescription('Warn decay days').setMinValue(1).setRequired(false))
      .addBooleanOption(o => o.setName('dm_on_action').setDescription('DM users on mod action').setRequired(false)))
    .addSubcommand(s => s
      .setName('tickets')
      .setDescription('Configure ticket settings')
      .addChannelOption(o => o.setName('category').setDescription('Ticket category channel').setRequired(false))
      .addRoleOption(o => o.setName('support_role').setDescription('Support role').setRequired(false))
      .addIntegerOption(o => o.setName('auto_close_hours').setDescription('Auto-close idle hours (0=off)').setMinValue(0).setRequired(false)))
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View current config')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig

    if (sub === 'prefix') {
      const prefix = interaction.options.getString('prefix')
      updateConfig(client, guildId, { prefix }, { prefix })
      return interaction.editReply({ embeds: [success('Prefix Updated', `Bot prefix set to \`${prefix}\`.`)] })
    }

    if (sub === 'modrole' || sub === 'adminrole') {
      const role   = interaction.options.getRole('role')
      const remove = interaction.options.getBoolean('remove') ?? false
      const field  = sub === 'modrole' ? 'mod_roles' : 'admin_roles'
      const arr    = safeParseArray(config?.[field])
      const label  = sub === 'modrole' ? 'mod' : 'admin'

      if (remove) {
        const updated = arr.filter(r => r !== role.id)
        updateConfig(client, guildId, { [field]: JSON.stringify(updated) }, { [field]: updated })
        return interaction.editReply({ embeds: [success('Role Removed', `${role} removed from ${label} roles.`)] })
      }

      if (!arr.includes(role.id)) arr.push(role.id)
      updateConfig(client, guildId, { [field]: JSON.stringify(arr) }, { [field]: arr })
      return interaction.editReply({ embeds: [success('Role Added', `${role} added to ${label} roles.`)] })
    }

    const channelSubs = {
      logchannel:  { field: 'log_channel',        label: 'Log Channel'   },
      modchannel:  { field: 'mod_channel',        label: 'Mod Channel'   },
      casechannel: { field: 'case_channel',       label: 'Case Channel'  },
      suggestions: { field: 'suggestions_channel', label: 'Suggestions Channel' }
    }

    if (channelSubs[sub]) {
      const ch = interaction.options.getChannel('channel')
      const { field, label } = channelSubs[sub]
      updateConfig(client, guildId, { [field]: ch.id }, { [field]: ch.id })
      return interaction.editReply({ embeds: [success(`${label} Set`, `${label} set to ${ch}.`)] })
    }

    if (sub === 'xp') {
      const fields = {}
      const min = interaction.options.getInteger('min')
      const max = interaction.options.getInteger('max')
      const cd  = interaction.options.getInteger('cooldown')
      const lch = interaction.options.getChannel('levelup_channel')
      if (min !== null) fields.xp_min          = min
      if (max !== null) fields.xp_max          = max
      if (cd  !== null) fields.xp_cooldown     = cd
      if (lch !== null) fields.levelup_channel = lch.id

      if (!Object.keys(fields).length) return interaction.editReply({ embeds: [error('Nothing changed', 'Provide at least one value.')] })
      updateConfig(client, guildId, fields, fields)
      return interaction.editReply({ embeds: [success('XP Config Updated', Object.entries(fields).map(([k, v]) => `**${k}:** \`${v}\``).join('\n'))] })
    }

    if (sub === 'warnings') {
      const fields = {}
      const threshold  = interaction.options.getInteger('threshold')
      const decayDays  = interaction.options.getInteger('decay_days')
      const dmOnAction = interaction.options.getBoolean('dm_on_action')
      if (threshold  !== null) fields.warn_threshold  = threshold
      if (decayDays  !== null) fields.warn_decay_days = decayDays
      if (dmOnAction !== null) fields.dm_on_action    = dmOnAction ? 1 : 0

      if (!Object.keys(fields).length) return interaction.editReply({ embeds: [error('Nothing changed', 'Provide at least one value.')] })
      updateConfig(client, guildId, fields, fields)
      return interaction.editReply({ embeds: [success('Warning Config Updated', Object.entries(fields).map(([k, v]) => `**${k}:** \`${v}\``).join('\n'))] })
    }

    if (sub === 'tickets') {
      const fields = {}
      const cat       = interaction.options.getChannel('category')
      const supRole   = interaction.options.getRole('support_role')
      const autoClose = interaction.options.getInteger('auto_close_hours')
      if (cat)              fields.ticket_category     = cat.id
      if (supRole)          fields.ticket_support_role = supRole.id
      if (autoClose !== null) fields.ticket_auto_close = autoClose

      if (!Object.keys(fields).length) return interaction.editReply({ embeds: [error('Nothing changed', 'Provide at least one value.')] })
      updateConfig(client, guildId, fields, fields)
      return interaction.editReply({ embeds: [success('Ticket Config Updated', '✅ Done.')] })
    }

    if (sub === 'view') {
      const modRoles   = safeParseArray(config?.mod_roles)
      const adminRoles = safeParseArray(config?.admin_roles)

      const embed = info('⚙️ Server Config', null)
        .addFields(
          { name: 'Prefix',         value: config?.prefix ?? '!',   inline: true },
          { name: 'Log Channel',    value: config?.log_channel    ? `<#${config.log_channel}>`    : 'Not set', inline: true },
          { name: 'Mod Channel',    value: config?.mod_channel    ? `<#${config.mod_channel}>`    : 'Not set', inline: true },
          { name: 'Case Channel',   value: config?.case_channel   ? `<#${config.case_channel}>`   : 'Not set', inline: true },
          { name: 'Welcome Ch',     value: config?.welcome_channel ? `<#${config.welcome_channel}>` : 'Not set', inline: true },
          { name: 'Suggestions',    value: config?.suggestions_channel ? `<#${config.suggestions_channel}>` : 'Not set', inline: true },
          { name: 'Mod Roles',      value: modRoles.length   ? modRoles.map(r => `<@&${r}>`).join(', ')   : 'None', inline: false },
          { name: 'Admin Roles',    value: adminRoles.length ? adminRoles.map(r => `<@&${r}>`).join(', ') : 'None', inline: false },
          { name: 'XP Settings',    value: `Min: ${config?.xp_min ?? 15} | Max: ${config?.xp_max ?? 25} | Cooldown: ${config?.xp_cooldown ?? 60}s`, inline: false },
          { name: 'Warn Threshold', value: `${config?.warn_threshold ?? 3} pts | Decay: ${config?.warn_decay_days ?? 30}d`, inline: true },
          { name: 'DM on action',   value: config?.dm_on_action ? 'Yes' : 'No', inline: true }
        )
      return interaction.editReply({ embeds: [embed] })
    }
  }
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
