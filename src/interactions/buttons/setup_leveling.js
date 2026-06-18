'use strict'

const { ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const {
  getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayChannel, display
} = require('../../../shared/setupBuilder')
const { updateConfig } = require('../../../shared/cache')

const MODULE = 'leveling'

function panelFromSession (guild, uid, pending) {
  const p = pending
  const blacklist = p.xp_blacklist ?? {}
  const blRoles = Array.isArray(blacklist.roles)    ? blacklist.roles.map(r => `<@&${r}>`).join(', ')  || 'None' : 'None'
  const blChs   = Array.isArray(blacklist.channels) ? blacklist.channels.map(c => `<#${c}>`).join(', ') || 'None' : 'None'

  const embed = buildSetupEmbed(guild, {
    title:       'Leveling Setup',
    description: 'Configure XP and leveling. Click **Save** when done.',
    state:       'pending',
    fields: [
      { name: 'XP per Message',    value: `${p.xp_min ?? 15} – ${p.xp_max ?? 25}`,         inline: true },
      { name: 'XP Cooldown',       value: `${p.xp_cooldown ?? 60}s`,                        inline: true },
      { name: 'Level-up Channel',  value: displayChannel(p.levelup_channel),                inline: true },
      { name: 'Level-up Message',  value: `\`${p.levelup_message ?? 'GG {user}, you reached level {level}!'}\``, inline: false },
      { name: 'Blacklist Roles',   value: blRoles,                                           inline: true },
      { name: 'Blacklist Channels',value: blChs,                                             inline: true },
    ]
  })

  const rows = buildRows([
    { id: `slevel_xprange:${uid}`,    label: 'XP Range'           },
    { id: `slevel_cooldown:${uid}`,   label: 'Cooldown'           },
    { id: `slevel_channel:${uid}`,    label: 'Level-up Channel'   },
    { id: `slevel_message:${uid}`,    label: 'Level-up Message'   },
    { id: `slevel_blacklist:${uid}`,  label: 'Blacklist'          },
    { id: `slevel_save:${uid}`,       label: 'Save',               style: ButtonStyle.Success },
  ])

  return { embeds: [embed], components: rows }
}

function openModal (interaction, opts) {
  const modal = new ModalBuilder().setCustomId(opts.customId).setTitle(opts.title)
  const input = new TextInputBuilder()
    .setCustomId(opts.fieldId).setLabel(opts.label)
    .setStyle(opts.long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(false)
  if (opts.placeholder) input.setPlaceholder(opts.placeholder)
  if (opts.value != null) input.setValue(String(opts.value))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

const slevel_xprange = {
  customId: /^slevel_xprange:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mlevel_xprange:${uid}`, title: 'XP Range',
      fieldId: 'range', label: 'Format: min max (e.g. 15 25)',
      placeholder: '15 25', value: `${s.pending.xp_min ?? 15} ${s.pending.xp_max ?? 25}`
    })
  }
}

const slevel_cooldown = {
  customId: /^slevel_cooldown:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mlevel_cooldown:${uid}`, title: 'XP Cooldown',
      fieldId: 'seconds', label: 'Cooldown between XP gains (seconds)',
      placeholder: '60', value: s.pending.xp_cooldown ?? 60
    })
  }
}

const slevel_channel = {
  customId: /^slevel_channel:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mlevel_channel:${uid}`, title: 'Level-up Channel',
      fieldId: 'channel_id', label: 'Channel ID (leave blank = same channel)',
      placeholder: 'Paste channel ID', value: s.pending.levelup_channel ?? ''
    })
  }
}

const slevel_message = {
  customId: /^slevel_message:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mlevel_message:${uid}`, title: 'Level-up Message',
      fieldId: 'message', label: 'Vars: {user} {level} {server}', long: true,
      placeholder: 'GG {user}, you reached level {level}!',
      value: s.pending.levelup_message ?? 'GG {user}, you reached level {level}!'
    })
  }
}

const slevel_blacklist = {
  customId: /^slevel_blacklist:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s  = getSession(uid, interaction.guild.id, MODULE)
    const bl = s.pending.xp_blacklist ?? {}
    return openModal(interaction, {
      customId: `mlevel_blacklist:${uid}`, title: 'XP Blacklist',
      fieldId: 'ids', long: true,
      label: 'One group per line (see placeholder)',
      placeholder: 'roles: 123456, 789012\nchannels: 345678, 901234',
      value: `roles: ${(bl.roles ?? []).join(', ')}\nchannels: ${(bl.channels ?? []).join(', ')}`
    })
  }
}

const slevel_save = {
  customId: /^slevel_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guildId, MODULE); const p = s.pending

    updateConfig(client, guildId, {
      xp_min:          p.xp_min          ?? 15,
      xp_max:          p.xp_max          ?? 25,
      xp_cooldown:     p.xp_cooldown     ?? 60,
      levelup_channel: p.levelup_channel ?? null,
      levelup_message: p.levelup_message ?? 'GG {user}, you reached level {level}!',
      xp_blacklist:    JSON.stringify(p.xp_blacklist ?? { roles: [], channels: [] })
    }, {
      xp_min: p.xp_min, xp_max: p.xp_max, xp_cooldown: p.xp_cooldown,
      levelup_channel: p.levelup_channel, levelup_message: p.levelup_message,
      xp_blacklist: p.xp_blacklist ?? { roles: [], channels: [] }
    })
    clearSession(uid, guildId, MODULE)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Leveling Setup', description: 'Leveling settings saved.', state: 'saved',
      fields: [
        { name: 'XP Range',   value: `${p.xp_min ?? 15} – ${p.xp_max ?? 25}`, inline: true },
        { name: 'Cooldown',   value: `${p.xp_cooldown ?? 60}s`,                 inline: true },
      ]
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

// ─── Modal handlers ───────────────────────────────────────────────────────────

const mlevel_xprange = {
  customId: /^mlevel_xprange:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    const [minStr, maxStr] = interaction.fields.getTextInputValue('range').trim().split(/\s+/)
    s.pending.xp_min = parseInt(minStr) || 15
    s.pending.xp_max = parseInt(maxStr) || 25
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

function makeModalHandler (pattern, field, transform) {
  return {
    customId: pattern,
    async execute (client, interaction) {
      await interaction.deferUpdate()
      const uid = interaction.user.id; const guildId = interaction.guild.id
      const s   = getSession(uid, guildId, MODULE); if (!s) return
      const raw = interaction.fields.getTextInputValue(interaction.fields.fields.first().customId)
      s.pending[field] = transform ? transform(raw) : raw.trim()
      setSession(uid, guildId, MODULE, s)
      await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
    }
  }
}

const mlevel_cooldown = makeModalHandler(/^mlevel_cooldown:/, 'xp_cooldown',     v => parseInt(v) || 60)
const mlevel_channel  = makeModalHandler(/^mlevel_channel:/,  'levelup_channel', v => v.replace(/\D/g, '') || null)
const mlevel_message  = makeModalHandler(/^mlevel_message:/,  'levelup_message', v => v.trim())

const mlevel_blacklist = {
  customId: /^mlevel_blacklist:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    const raw = interaction.fields.getTextInputValue('ids')

    const roles = []; const channels = []
    for (const line of raw.split('\n')) {
      const [prefix, ...rest] = line.split(':')
      const ids = (rest.join(':') || '').split(',').map(v => v.trim().replace(/\D/g, '')).filter(Boolean)
      if (prefix.trim() === 'roles')    roles.push(...ids)
      if (prefix.trim() === 'channels') channels.push(...ids)
    }

    s.pending.xp_blacklist = { roles, channels }
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

module.exports = [
  slevel_xprange, slevel_cooldown, slevel_channel, slevel_message, slevel_blacklist, slevel_save,
  mlevel_xprange, mlevel_cooldown, mlevel_channel, mlevel_message, mlevel_blacklist
]
