'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }         = require('../../../shared/cache')
const { success, error, info } = require('../../../shared/embed')

const EVENT_TYPES = [
  'message_edit',
  'message_delete',
  'bulk_delete',
  'member_join',
  'member_leave',
  'member_update',
  'invite',
  'role_change',
  'channel_change',
  'voice',
  'mod_action',
  'ban',
  'unban',
  'automod'
]

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure log routing')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s
      .setName('set')
      .setDescription('Route a log event to a channel')
      .addStringOption(o => o.setName('event').setDescription('Event type').setRequired(true)
        .addChoices(...EVENT_TYPES.map(e => ({ name: e, value: e }))))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to log to').setRequired(true)))

    .addSubcommand(s => s
      .setName('unset')
      .setDescription('Remove a log route')
      .addStringOption(o => o.setName('event').setDescription('Event type').setRequired(true)
        .addChoices(...EVENT_TYPES.map(e => ({ name: e, value: e })))))

    .addSubcommand(s => s
      .setName('view')
      .setDescription('Show all current log routes'))

    .addSubcommand(s => s
      .setName('ignore')
      .setDescription('Add/remove a channel or role from logging')
      .addStringOption(o => o.setName('type').setDescription('Ignore channel or role').setRequired(true)
        .addChoices({ name: 'Channel', value: 'channel' }, { name: 'Role', value: 'role' }))
      .addStringOption(o => o.setName('id').setDescription('Channel or role ID').setRequired(true))
      .addBooleanOption(o => o.setName('remove').setDescription('Remove from ignore list').setRequired(false)))

    .addSubcommand(s => s
      .setName('reset')
      .setDescription('Clear all log routes and ignore lists')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig

    const routes       = parseObj(config?.log_routes)
    const ignoreRoles  = safeArr(config?.log_ignore_roles)
    const ignoreChs    = safeArr(config?.log_ignore_channels)

    if (sub === 'set') {
      const event   = interaction.options.getString('event')
      const channel = interaction.options.getChannel('channel')

      if (!channel.isTextBased()) {
        return interaction.editReply({ embeds: [error('Invalid', 'Must be a text channel.')] })
      }

      routes[event] = channel.id
      updateConfig(client, guildId, { log_routes: JSON.stringify(routes) }, { log_routes: routes })

      return interaction.editReply({
        embeds: [success('Log Route Set', `**${event}** logs → ${channel}`)]
      })
    }

    if (sub === 'unset') {
      const event = interaction.options.getString('event')
      delete routes[event]
      updateConfig(client, guildId, { log_routes: JSON.stringify(routes) }, { log_routes: routes })
      return interaction.editReply({ embeds: [success('Route Removed', `**${event}** log route cleared.`)] })
    }

    if (sub === 'view') {
      const fallback = config?.log_channel ? `<#${config.log_channel}> (fallback)` : 'None'
      const lines    = EVENT_TYPES.map(e =>
        routes[e] ? `**${e}** → <#${routes[e]}>` : `**${e}** → ${fallback}`
      ).join('\n')

      const ignRoleList = ignoreRoles.length ? ignoreRoles.map(r => `<@&${r}>`).join(', ') : 'None'
      const ignChList   = ignoreChs.length   ? ignoreChs.map(c => `<#${c}>`).join(', ')   : 'None'

      const embed = info('📋 Log Routes', lines)
        .addFields(
          { name: 'Ignored Roles',    value: ignRoleList, inline: false },
          { name: 'Ignored Channels', value: ignChList,   inline: false }
        )

      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'ignore') {
      const type   = interaction.options.getString('type')
      const id     = interaction.options.getString('id').replace(/\D/g, '')
      const remove = interaction.options.getBoolean('remove') ?? false

      if (type === 'channel') {
        const updated = remove
          ? ignoreChs.filter(c => c !== id)
          : ignoreChs.includes(id) ? ignoreChs : [...ignoreChs, id]
        updateConfig(client, guildId,
          { log_ignore_channels: JSON.stringify(updated) },
          { log_ignore_channels: updated }
        )
        return interaction.editReply({
          embeds: [success(remove ? 'Removed' : 'Added', `<#${id}> ${remove ? 'removed from' : 'added to'} log ignore list.`)]
        })
      }

      if (type === 'role') {
        const updated = remove
          ? ignoreRoles.filter(r => r !== id)
          : ignoreRoles.includes(id) ? ignoreRoles : [...ignoreRoles, id]
        updateConfig(client, guildId,
          { log_ignore_roles: JSON.stringify(updated) },
          { log_ignore_roles: updated }
        )
        return interaction.editReply({
          embeds: [success(remove ? 'Removed' : 'Added', `<@&${id}> ${remove ? 'removed from' : 'added to'} log ignore list.`)]
        })
      }
    }

    if (sub === 'reset') {
      updateConfig(client, guildId, {
        log_routes:          '{}',
        log_ignore_roles:    '[]',
        log_ignore_channels: '[]'
      }, {
        log_routes:          {},
        log_ignore_roles:    [],
        log_ignore_channels: []
      })
      return interaction.editReply({ embeds: [success('Logs Reset', 'All log routes and ignore lists cleared.')] })
    }
  }
}

function parseObj (val) {
  if (!val) return {}
  if (typeof val === 'object' && !Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return {} }
}

function safeArr (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
