'use strict'

// ─── Welcome setup button/modal handlers ─────────────────────────────────────
// Handles all swelcome_* button and modal interactions.
// Drop this in src/interactions/buttons/setup_welcome.js
// The interactionHandler picks up all exports automatically via the array.

const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, MessageFlags, ButtonStyle
} = require('discord.js')

const { getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayChannel, displayBool, display }
  = require('../../../shared/setupBuilder')
const { updateConfig } = require('../../../shared/cache')
const db               = require('../../../shared/db')

const MODULE = 'welcome'
const STYLES = ['embed', 'card', 'plain']
const BG_SOURCES = ['default', 'banner', 'custom']
const AVATAR_SRCS = ['user', 'server']

// ─── Shared: rebuild panel from session ──────────────────────────────────────
function panelFromSession (guild, uid, pending) {
  const p = pending
  const autoroles = Array.isArray(p.welcome_autorole)
    ? p.welcome_autorole.map(r => `<@&${r}>`).join(', ') || 'None'
    : 'None'

  const embed = buildSetupEmbed(guild, {
    title:       'Welcome Setup',
    description: 'Unsaved changes are shown below. Click **Save** to apply.',
    state:       'pending',
    fields: [
      { name: 'Welcome Channel',  value: displayChannel(p.welcome_channel),                              inline: true  },
      { name: 'Goodbye Channel',  value: displayChannel(p.goodbye_channel),                              inline: true  },
      { name: 'Style',            value: p.welcome_style ?? 'embed',                                     inline: true  },
      { name: 'Background',       value: p.welcome_bg_source ?? 'default',                               inline: true  },
      { name: 'Avatar',           value: displayBool(p.welcome_show_avatar ?? 1),                        inline: true  },
      { name: 'Avatar Source',    value: p.welcome_avatar_src ?? 'user',                                 inline: true  },
      { name: 'DM on Join',       value: displayBool(p.welcome_dm),                                      inline: true  },
      { name: 'Auto Role',        value: autoroles,                                                       inline: true  },
      { name: 'Color',            value: display(p.welcome_color),                                       inline: true  },
      { name: 'Welcome Message',  value: `\`${p.welcome_message ?? 'Welcome {user} to {server}!'}\``,   inline: false },
      { name: 'Goodbye Message',  value: `\`${p.goodbye_message ?? '{username} has left {server}.'}\``, inline: false },
    ]
  })

  const rows = buildRows([
    { id: `swelcome_channel:${uid}`,     label: 'Welcome Channel'  },
    { id: `swelcome_goodbye:${uid}`,     label: 'Goodbye Channel'  },
    { id: `swelcome_message:${uid}`,     label: 'Welcome Message'  },
    { id: `swelcome_goodbyemsg:${uid}`,  label: 'Goodbye Message'  },
    { id: `swelcome_style:${uid}`,       label: 'Cycle Style',      style: ButtonStyle.Secondary },
    { id: `swelcome_bg:${uid}`,          label: 'Background'       },
    { id: `swelcome_color:${uid}`,       label: 'Set Color'        },
    { id: `swelcome_avatar:${uid}`,      label: 'Toggle Avatar',    style: ButtonStyle.Secondary },
    { id: `swelcome_avatarsrc:${uid}`,   label: 'Avatar Source',    style: ButtonStyle.Secondary },
    { id: `swelcome_dm:${uid}`,          label: 'Toggle DM',        style: ButtonStyle.Secondary },
    { id: `swelcome_dmmessage:${uid}`,   label: 'DM Message'       },
    { id: `swelcome_autorole:${uid}`,    label: 'Auto Role'        },
    { id: `swelcome_test:${uid}`,        label: 'Preview',          style: ButtonStyle.Secondary },
    { id: `swelcome_save:${uid}`,        label: 'Save',             style: ButtonStyle.Success   },
  ])

  return { embeds: [embed], components: rows }
}

// ─── Helper: open a single-field modal ───────────────────────────────────────
function openModal (interaction, { customId, title, fieldId, label, placeholder, value, long = false }) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title)
  const input = new TextInputBuilder()
    .setCustomId(fieldId)
    .setLabel(label)
    .setStyle(long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(true)
  if (placeholder) input.setPlaceholder(placeholder)
  if (value)       input.setValue(String(value).slice(0, 4000))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

// ─── BUTTON HANDLERS ─────────────────────────────────────────────────────────

const swelcome_channel = {
  customId: /^swelcome_channel:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId:    `mwelcome_channel:${uid}`,
      title:       'Welcome Channel',
      fieldId:     'channel_id',
      label:       'Channel ID',
      placeholder: 'Paste the channel ID',
      value:       s.pending.welcome_channel ?? ''
    })
  }
}

const swelcome_goodbye = {
  customId: /^swelcome_goodbye:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId:    `mwelcome_goodbye:${uid}`,
      title:       'Goodbye Channel',
      fieldId:     'channel_id',
      label:       'Channel ID',
      placeholder: 'Paste the channel ID',
      value:       s.pending.goodbye_channel ?? ''
    })
  }
}

const swelcome_message = {
  customId: /^swelcome_message:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId:    `mwelcome_message:${uid}`,
      title:       'Welcome Message',
      fieldId:     'message',
      label:       'Message (vars: {user} {username} {server} {member_count})',
      placeholder: 'Welcome {user} to {server}!',
      value:       s.pending.welcome_message ?? '',
      long:        true
    })
  }
}

const swelcome_goodbyemsg = {
  customId: /^swelcome_goodbyemsg:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId:    `mwelcome_goodbyemsg:${uid}`,
      title:       'Goodbye Message',
      fieldId:     'message',
      label:       'Message (vars: {username} {server} {member_count})',
      placeholder: '{username} has left {server}.',
      value:       s.pending.goodbye_message ?? '',
      long:        true
    })
  }
}

// Cycle-on-click — no modal needed
const swelcome_style = {
  customId: /^swelcome_style:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s    = getSession(uid, interaction.guild.id, MODULE)
    const cur  = s.pending.welcome_style ?? 'embed'
    const next = STYLES[(STYLES.indexOf(cur) + 1) % STYLES.length]
    s.pending.welcome_style = next
    setSession(uid, interaction.guild.id, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const swelcome_bg = {
  customId: /^swelcome_bg:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s   = getSession(uid, interaction.guild.id, MODULE)
    const cur = s.pending.welcome_bg_source ?? 'default'
    // Show sub-choice buttons in a follow-up modal flow
    return openModal(interaction, {
      customId:    `mwelcome_bg:${uid}`,
      title:       'Background',
      fieldId:     'bg_source',
      label:       'Source: default | banner | custom',
      placeholder: 'Enter: default, banner, or a direct image URL',
      value:       cur
    })
  }
}

const swelcome_color = {
  customId: /^swelcome_color:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId:    `mwelcome_color:${uid}`,
      title:       'Welcome Color',
      fieldId:     'color',
      label:       'Hex color code',
      placeholder: '#5865F2',
      value:       s.pending.welcome_color ?? '#5865F2'
    })
  }
}

const swelcome_avatar = {
  customId: /^swelcome_avatar:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    s.pending.welcome_show_avatar = s.pending.welcome_show_avatar ? 0 : 1
    setSession(uid, interaction.guild.id, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const swelcome_avatarsrc = {
  customId: /^swelcome_avatarsrc:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s   = getSession(uid, interaction.guild.id, MODULE)
    const cur = s.pending.welcome_avatar_src ?? 'user'
    s.pending.welcome_avatar_src = AVATAR_SRCS[(AVATAR_SRCS.indexOf(cur) + 1) % AVATAR_SRCS.length]
    setSession(uid, interaction.guild.id, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const swelcome_dm = {
  customId: /^swelcome_dm:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    s.pending.welcome_dm = s.pending.welcome_dm ? 0 : 1
    setSession(uid, interaction.guild.id, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const swelcome_dmmessage = {
  customId: /^swelcome_dmmessage:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId:    `mwelcome_dmmessage:${uid}`,
      title:       'DM Message',
      fieldId:     'message',
      label:       'DM sent to new members',
      placeholder: 'Welcome to {server}! Read the rules in #rules.',
      value:       s.pending.welcome_dm_message ?? '',
      long:        true
    })
  }
}

const swelcome_autorole = {
  customId: /^swelcome_autorole:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    const current = Array.isArray(s.pending.welcome_autorole)
      ? s.pending.welcome_autorole.join(', ')
      : ''
    return openModal(interaction, {
      customId:    `mwelcome_autorole:${uid}`,
      title:       'Auto Roles on Join',
      fieldId:     'role_ids',
      label:       'Role IDs (comma-separated, leave blank to clear)',
      placeholder: '123456789, 987654321',
      value:       current
    })
  }
}

const swelcome_test = {
  customId: /^swelcome_test:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid    = interaction.user.id
    const guild  = interaction.guild
    const member = interaction.member

    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guild.id, MODULE)

    // Build a preview using pending values
    const { EmbedBuilder } = require('discord.js')
    const { resolveWelcomeVars } = require('../../../shared/utils')

    const color = parseInt((s.pending.welcome_color ?? '#5865F2').replace('#', ''), 16) || 0x5865F2
    const text  = resolveWelcomeVars(s.pending.welcome_message ?? 'Welcome {user} to {server}!', member)

    const preview = new EmbedBuilder()
      .setColor(color)
      .setDescription(text)
      .setTimestamp()
      .setFooter({ text: 'Preview — not saved yet' })

    if (s.pending.welcome_show_avatar) {
      const avatarUrl = s.pending.welcome_avatar_src === 'server'
        ? guild.iconURL({ size: 128 })
        : member.user.displayAvatarURL({ size: 128 })
      if (avatarUrl) preview.setThumbnail(avatarUrl)
    }

    await interaction.followUp({ embeds: [preview], flags: MessageFlags.Ephemeral })
  }
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────
const swelcome_save = {
  customId: /^swelcome_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id

    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guildId, MODULE)
    const p = s.pending

    const dbFields = {
      welcome_channel:     p.welcome_channel     ?? null,
      goodbye_channel:     p.goodbye_channel     ?? null,
      welcome_style:       p.welcome_style        ?? 'embed',
      welcome_message:     p.welcome_message      ?? 'Welcome {user} to {server}!',
      goodbye_message:     p.goodbye_message      ?? '{username} has left {server}.',
      welcome_color:       p.welcome_color        ?? '#5865F2',
      welcome_bg_url:      p.welcome_bg_source === 'custom' ? (p.welcome_bg_url ?? null) : null,
      welcome_bg_source:   p.welcome_bg_source    ?? 'default',
      welcome_show_avatar: p.welcome_show_avatar  ?? 1,
      welcome_avatar_src:  p.welcome_avatar_src   ?? 'user',
      welcome_dm:          p.welcome_dm           ?? 0,
      welcome_dm_message:  p.welcome_dm_message   ?? null,
      welcome_autorole:    JSON.stringify(Array.isArray(p.welcome_autorole) ? p.welcome_autorole : [])
    }

    updateConfig(client, guildId, dbFields, {
      ...dbFields,
      welcome_autorole: Array.isArray(p.welcome_autorole) ? p.welcome_autorole : []
    })
    clearSession(uid, guildId, MODULE)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title:       'Welcome Setup',
      description: 'All welcome settings have been saved.',
      state:       'saved',
      fields: [
        { name: 'Welcome Channel', value: p.welcome_channel ? `<#${p.welcome_channel}>` : 'Not set', inline: true },
        { name: 'Style',           value: p.welcome_style ?? 'embed',                                 inline: true },
        { name: 'DM on Join',      value: p.welcome_dm ? 'Enabled' : 'Disabled',                      inline: true },
      ]
    })

    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

// ─── MODAL HANDLERS ───────────────────────────────────────────────────────────

function makeModalHandler (customIdPattern, field, transform) {
  return {
    customId: customIdPattern,
    async execute (client, interaction) {
      await interaction.deferUpdate()
      const uid     = interaction.user.id
      const guildId = interaction.guild.id
      const s       = getSession(uid, guildId, MODULE)
      if (!s) return interaction.followUp({ content: 'Session expired. Run /welcome again.', flags: MessageFlags.Ephemeral })

      const raw   = interaction.fields.getTextInputValue(Object.keys(interaction.fields.fields.toJSON())[0])
      const value = transform ? transform(raw) : raw

      s.pending[field] = value
      setSession(uid, guildId, MODULE, s)

      await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
    }
  }
}

const mwelcome_channel = makeModalHandler(/^mwelcome_channel:/, 'welcome_channel', v => v.replace(/\D/g, '') || null)
const mwelcome_goodbye = makeModalHandler(/^mwelcome_goodbye:/, 'goodbye_channel', v => v.replace(/\D/g, '') || null)
const mwelcome_message = makeModalHandler(/^mwelcome_message:/, 'welcome_message', v => v.trim())
const mwelcome_goodbyemsg = makeModalHandler(/^mwelcome_goodbyemsg:/, 'goodbye_message', v => v.trim())
const mwelcome_color   = makeModalHandler(/^mwelcome_color:/,   'welcome_color',   v => v.startsWith('#') ? v : `#${v}`)
const mwelcome_dmmessage = makeModalHandler(/^mwelcome_dmmessage:/, 'welcome_dm_message', v => v.trim())

const mwelcome_bg = {
  customId: /^mwelcome_bg:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const s       = getSession(uid, guildId, MODULE)
    if (!s) return

    const raw = interaction.fields.getTextInputValue('bg_source').trim().toLowerCase()

    if (raw === 'default' || raw === 'banner') {
      s.pending.welcome_bg_source = raw
      s.pending.welcome_bg_url    = null
    } else {
      // Treat as a URL
      s.pending.welcome_bg_source = 'custom'
      s.pending.welcome_bg_url    = raw
    }

    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const mwelcome_autorole = {
  customId: /^mwelcome_autorole:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const s       = getSession(uid, guildId, MODULE)
    if (!s) return

    const raw  = interaction.fields.getTextInputValue('role_ids').trim()
    const ids  = raw
      ? raw.split(',').map(r => r.trim().replace(/\D/g, '')).filter(Boolean)
      : []

    s.pending.welcome_autorole = ids
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

// ─── Exports (interactionHandler picks each up by customId) ──────────────────
module.exports = [
  swelcome_channel, swelcome_goodbye, swelcome_message, swelcome_goodbyemsg,
  swelcome_style, swelcome_bg, swelcome_color, swelcome_avatar, swelcome_avatarsrc,
  swelcome_dm, swelcome_dmmessage, swelcome_autorole, swelcome_test, swelcome_save,
  mwelcome_channel, mwelcome_goodbye, mwelcome_message, mwelcome_goodbyemsg,
  mwelcome_color, mwelcome_dmmessage, mwelcome_bg, mwelcome_autorole
]
