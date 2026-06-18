'use strict'

const { ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const {
  getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayChannel
} = require('../../../shared/setupBuilder')
const { updateConfig } = require('../../../shared/cache')

const MODULE = 'logging'

const EVENT_TYPES = [
  'message_edit', 'message_delete', 'bulk_delete',
  'member_join', 'member_leave', 'member_update',
  'invite', 'role_change', 'channel_change',
  'voice', 'mod_action', 'ban', 'unban', 'automod'
]

function routeDisplay (routes, event) {
  return routes?.[event] ? `<#${routes[event]}>` : 'Not set'
}

function panelFromSession (guild, uid, pending) {
  const r = pending.log_routes ?? {}

  const fields = EVENT_TYPES.map(e => ({
    name:   e,
    value:  routeDisplay(r, e),
    inline: true
  }))

  const ignoreRoles = (pending.log_ignore_roles ?? []).map(id => `<@&${id}>`).join(', ') || 'None'
  const ignoreChs   = (pending.log_ignore_channels ?? []).map(id => `<#${id}>`).join(', ')  || 'None'

  fields.push(
    { name: 'Ignored Roles',    value: ignoreRoles, inline: false },
    { name: 'Ignored Channels', value: ignoreChs,   inline: false }
  )

  const embed = buildSetupEmbed(guild, {
    title:       'Logging Setup',
    description: 'Route each event to a channel. Leave blank to disable that event log.',
    state:       'pending',
    fields
  })

  const rows = buildRows([
    { id: `slogs_routes:${uid}`,   label: 'Set Event Routes' },
    { id: `slogs_fallback:${uid}`, label: 'Fallback Channel' },
    { id: `slogs_ignore:${uid}`,   label: 'Ignore Roles/Channels' },
    { id: `slogs_clear:${uid}`,    label: 'Clear All Routes',    style: ButtonStyle.Danger     },
    { id: `slogs_save:${uid}`,     label: 'Save',                style: ButtonStyle.Success    },
  ])

  return { embeds: [embed], components: rows }
}

function openModal (interaction, opts) {
  const modal = new ModalBuilder().setCustomId(opts.customId).setTitle(opts.title)
  const input = new TextInputBuilder()
    .setCustomId(opts.fieldId).setLabel(opts.label)
    .setStyle(opts.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(false)
  if (opts.placeholder) input.setPlaceholder(opts.placeholder)
  if (opts.value)       input.setValue(String(opts.value))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

// Route setter — one modal, user enters "event_type channel_id" lines
const slogs_routes = {
  customId: /^slogs_routes:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s     = getSession(uid, interaction.guild.id, MODULE)
    const lines = Object.entries(s.pending.log_routes ?? {})
      .map(([e, ch]) => `${e} ${ch}`).join('\n')
    return openModal(interaction, {
      customId: `mlogs_routes:${uid}`, title: 'Set Event Routes',
      fieldId: 'routes', long: true,
      label: 'One per line: event_type channel_id',
      placeholder: 'message_delete 123456789\nmember_join 987654321',
      value: lines
    })
  }
}

const slogs_fallback = {
  customId: /^slogs_fallback:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mlogs_fallback:${uid}`, title: 'Fallback Log Channel',
      fieldId: 'channel_id', label: 'Channel ID (used if no specific route set)',
      placeholder: 'Paste channel ID', value: s.pending.log_channel ?? ''
    })
  }
}

const slogs_ignore = {
  customId: /^slogs_ignore:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    const roles = (s.pending.log_ignore_roles ?? []).join(', ')
    const chs   = (s.pending.log_ignore_channels ?? []).join(', ')
    return openModal(interaction, {
      customId: `mlogs_ignore:${uid}`, title: 'Ignore from Logging',
      fieldId: 'ids', long: true,
      label: 'Role IDs then Channel IDs (comma-separated, one group per line)',
      placeholder: 'roles: 123456, 789012\nchannels: 345678, 901234',
      value: `roles: ${roles}\nchannels: ${chs}`
    })
  }
}

const slogs_clear = {
  customId: /^slogs_clear:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    s.pending.log_routes          = {}
    s.pending.log_ignore_roles    = []
    s.pending.log_ignore_channels = []
    setSession(uid, interaction.guild.id, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const slogs_save = {
  customId: /^slogs_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guildId, MODULE); const p = s.pending

    updateConfig(client, guildId, {
      log_channel:         p.log_channel         ?? null,
      log_routes:          JSON.stringify(p.log_routes ?? {}),
      log_ignore_roles:    JSON.stringify(p.log_ignore_roles ?? []),
      log_ignore_channels: JSON.stringify(p.log_ignore_channels ?? []),
    }, {
      log_channel:         p.log_channel,
      log_routes:          p.log_routes ?? {},
      log_ignore_roles:    p.log_ignore_roles ?? [],
      log_ignore_channels: p.log_ignore_channels ?? []
    })
    clearSession(uid, guildId, MODULE)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Logging Setup', description: 'Log routes saved.', state: 'saved',
      fields: [
        { name: 'Routes configured', value: String(Object.keys(p.log_routes ?? {}).length), inline: true },
        { name: 'Fallback channel',  value: p.log_channel ? `<#${p.log_channel}>` : 'None', inline: true }
      ]
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

// ─── Modal handlers ───────────────────────────────────────────────────────────

const mlogs_routes = {
  customId: /^mlogs_routes:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    const raw = interaction.fields.getTextInputValue('routes')

    const routes = {}
    for (const line of raw.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2 && EVENT_TYPES.includes(parts[0])) {
        const chId = parts[1].replace(/\D/g, '')
        if (chId) routes[parts[0]] = chId
      }
    }

    s.pending.log_routes = routes
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const mlogs_fallback = {
  customId: /^mlogs_fallback:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    s.pending.log_channel = interaction.fields.getTextInputValue('channel_id').replace(/\D/g, '') || null
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const mlogs_ignore = {
  customId: /^mlogs_ignore:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    const raw = interaction.fields.getTextInputValue('ids')

    const roleIds = []; const chIds = []
    for (const line of raw.split('\n')) {
      const [prefix, ...rest] = line.split(':')
      const ids = (rest.join(':') || '').split(',').map(v => v.trim().replace(/\D/g, '')).filter(Boolean)
      if (prefix.trim() === 'roles')    roleIds.push(...ids)
      if (prefix.trim() === 'channels') chIds.push(...ids)
    }

    s.pending.log_ignore_roles    = roleIds
    s.pending.log_ignore_channels = chIds
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

module.exports = [
  slogs_routes, slogs_fallback, slogs_ignore, slogs_clear, slogs_save,
  mlogs_routes, mlogs_fallback, mlogs_ignore
]
