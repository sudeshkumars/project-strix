'use strict'

const { ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const {
  getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayChannel, displayRole, display
} = require('../../../shared/setupBuilder')
const { updateConfig } = require('../../../shared/cache')

const MODULE = 'general'

function panelFromSession (guild, uid, pending) {
  const p = pending

  const modRoles   = Array.isArray(p.mod_roles)   ? p.mod_roles.map(r   => `<@&${r}>`).join(', ')  || 'None' : 'None'
  const adminRoles = Array.isArray(p.admin_roles)  ? p.admin_roles.map(r => `<@&${r}>`).join(', ')  || 'None' : 'None'

  const embed = buildSetupEmbed(guild, {
    title:       'General Setup',
    description: 'Configure core bot settings. Click **Save** when done.',
    state:       'pending',
    fields: [
      { name: 'Prefix',           value: display(p.prefix, ''),         inline: true },
      { name: 'Language',         value: display(p.language, ''),       inline: true },
      { name: 'Mute Role',        value: displayRole(p.mute_role),      inline: true },
      { name: 'Mod Roles',        value: modRoles,                      inline: false },
      { name: 'Admin Roles',      value: adminRoles,                    inline: false },
      { name: 'Log Channel',      value: displayChannel(p.log_channel), inline: true },
      { name: 'Mod Channel',      value: displayChannel(p.mod_channel), inline: true },
      { name: 'Case Channel',     value: displayChannel(p.case_channel),inline: true },
      { name: 'Updates Channel',  value: displayChannel(p.updates_channel_id), inline: true },
    ]
  })

  const rows = buildRows([
    { id: `sgeneral_prefix:${uid}`,      label: 'Set Prefix'        },
    { id: `sgeneral_language:${uid}`,    label: 'Set Language'      },
    { id: `sgeneral_muterole:${uid}`,    label: 'Set Mute Role'     },
    { id: `sgeneral_modroles:${uid}`,    label: 'Mod Roles'         },
    { id: `sgeneral_adminroles:${uid}`,  label: 'Admin Roles'       },
    { id: `sgeneral_logch:${uid}`,       label: 'Log Channel'       },
    { id: `sgeneral_modch:${uid}`,       label: 'Mod Channel'       },
    { id: `sgeneral_casech:${uid}`,      label: 'Case Channel'      },
    { id: `sgeneral_updatesch:${uid}`,   label: 'Updates Channel'   },
    { id: `sgeneral_save:${uid}`,        label: 'Save',              style: ButtonStyle.Success },
  ])

  return { embeds: [embed], components: rows }
}

function openModal (interaction, opts) {
  const modal = new ModalBuilder().setCustomId(opts.customId).setTitle(opts.title)
  const input = new TextInputBuilder()
    .setCustomId(opts.fieldId)
    .setLabel(opts.label)
    .setStyle(opts.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(true)
  if (opts.placeholder) input.setPlaceholder(opts.placeholder)
  if (opts.value)       input.setValue(String(opts.value).slice(0, 4000))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

function makeButtonHandler (customIdPattern, modalOpts) {
  return {
    customId: customIdPattern,
    async execute (client, interaction) {
      const uid = interaction.user.id
      if (await guardSession(interaction, MODULE)) return
      const s = getSession(uid, interaction.guild.id, MODULE)
      return openModal(interaction, {
        ...modalOpts(s, uid),
        customId: modalOpts(s, uid).customId.replace(':uid', `:${uid}`)
      })
    }
  }
}

// ─── Button handlers ──────────────────────────────────────────────────────────

const sgeneral_prefix = {
  customId: /^sgeneral_prefix:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mgeneral_prefix:${uid}`, title: 'Set Prefix',
      fieldId: 'prefix', label: 'Command prefix (max 5 chars)',
      placeholder: '!', value: s.pending.prefix ?? '!'
    })
  }
}

const sgeneral_language = {
  customId: /^sgeneral_language:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mgeneral_language:${uid}`, title: 'Set Language',
      fieldId: 'language', label: 'Language code (e.g. en)',
      placeholder: 'en', value: s.pending.language ?? 'en'
    })
  }
}

const sgeneral_muterole = {
  customId: /^sgeneral_muterole:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mgeneral_muterole:${uid}`, title: 'Mute Role',
      fieldId: 'role_id', label: 'Role ID',
      placeholder: 'Paste role ID', value: s.pending.mute_role ?? ''
    })
  }
}

const sgeneral_modroles = {
  customId: /^sgeneral_modroles:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s    = getSession(uid, interaction.guild.id, MODULE)
    const curr = Array.isArray(s.pending.mod_roles) ? s.pending.mod_roles.join(', ') : ''
    return openModal(interaction, {
      customId: `mgeneral_modroles:${uid}`, title: 'Mod Roles',
      fieldId: 'role_ids', label: 'Role IDs (comma-separated)',
      placeholder: '123456789, 987654321', value: curr
    })
  }
}

const sgeneral_adminroles = {
  customId: /^sgeneral_adminroles:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s    = getSession(uid, interaction.guild.id, MODULE)
    const curr = Array.isArray(s.pending.admin_roles) ? s.pending.admin_roles.join(', ') : ''
    return openModal(interaction, {
      customId: `mgeneral_adminroles:${uid}`, title: 'Admin Roles',
      fieldId: 'role_ids', label: 'Role IDs (comma-separated)',
      placeholder: '123456789', value: curr
    })
  }
}

function makeChannelButton (customIdBase, modalTitle, field) {
  return {
    customId: new RegExp(`^${customIdBase}:`),
    async execute (client, interaction) {
      const uid = interaction.user.id
      if (await guardSession(interaction, MODULE)) return
      const s = getSession(uid, interaction.guild.id, MODULE)
      return openModal(interaction, {
        customId: `m${customIdBase}:${uid}`, title: modalTitle,
        fieldId: 'channel_id', label: 'Channel ID',
        placeholder: 'Paste channel ID', value: s.pending[field] ?? ''
      })
    }
  }
}

const sgeneral_logch     = makeChannelButton('sgeneral_logch',    'Log Channel',     'log_channel')
const sgeneral_modch     = makeChannelButton('sgeneral_modch',    'Mod Channel',     'mod_channel')
const sgeneral_casech    = makeChannelButton('sgeneral_casech',   'Case Channel',    'case_channel')
const sgeneral_updatesch = makeChannelButton('sgeneral_updatesch','Updates Channel', 'updates_channel_id')

const sgeneral_save = {
  customId: /^sgeneral_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guildId, MODULE)
    const p = s.pending

    const dbFields = {
      prefix:             p.prefix           ?? '!',
      language:           p.language         ?? 'en',
      mute_role:          p.mute_role        ?? null,
      mod_roles:          JSON.stringify(Array.isArray(p.mod_roles)   ? p.mod_roles   : []),
      admin_roles:        JSON.stringify(Array.isArray(p.admin_roles) ? p.admin_roles : []),
      log_channel:        p.log_channel      ?? null,
      mod_channel:        p.mod_channel      ?? null,
      case_channel:       p.case_channel     ?? null,
      updates_channel_id: p.updates_channel_id ?? null,
      setup_complete:     1
    }

    updateConfig(client, guildId, dbFields, {
      ...dbFields,
      mod_roles:   Array.isArray(p.mod_roles)   ? p.mod_roles   : [],
      admin_roles: Array.isArray(p.admin_roles) ? p.admin_roles : []
    })
    clearSession(uid, guildId, MODULE)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title:       'General Setup',
      description: 'General settings have been saved.',
      state:       'saved',
      fields: [
        { name: 'Prefix',      value: p.prefix      ?? '!',   inline: true },
        { name: 'Log Channel', value: p.log_channel  ? `<#${p.log_channel}>` : 'Not set', inline: true },
        { name: 'Mod Channel', value: p.mod_channel  ? `<#${p.mod_channel}>` : 'Not set', inline: true },
      ]
    })

    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

// ─── Modal handlers ───────────────────────────────────────────────────────────

function makeModalHandler (pattern, field, transform) {
  return {
    customId: pattern,
    async execute (client, interaction) {
      await interaction.deferUpdate()
      const uid     = interaction.user.id
      const guildId = interaction.guild.id
      const s       = getSession(uid, guildId, MODULE)
      if (!s) return

      const raw   = interaction.fields.getTextInputValue(interaction.fields.fields.first().customId)
      const value = transform ? transform(raw) : raw.trim()
      s.pending[field] = value
      setSession(uid, guildId, MODULE, s)
      await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
    }
  }
}

const mgeneral_prefix     = makeModalHandler(/^mgeneral_prefix:/,     'prefix',             v => v.trim().slice(0, 5))
const mgeneral_language   = makeModalHandler(/^mgeneral_language:/,   'language',           v => v.trim().toLowerCase().slice(0, 5))
const mgeneral_muterole   = makeModalHandler(/^mgeneral_muterole:/,   'mute_role',          v => v.replace(/\D/g, '') || null)
const mgeneral_logch      = makeModalHandler(/^msgeneral_logch:/,     'log_channel',        v => v.replace(/\D/g, '') || null)
const mgeneral_modch      = makeModalHandler(/^msgeneral_modch:/,     'mod_channel',        v => v.replace(/\D/g, '') || null)
const mgeneral_casech     = makeModalHandler(/^msgeneral_casech:/,    'case_channel',       v => v.replace(/\D/g, '') || null)
const mgeneral_updatesch  = makeModalHandler(/^msgeneral_updatesch:/, 'updates_channel_id', v => v.replace(/\D/g, '') || null)

const mgeneral_modroles = {
  customId: /^mgeneral_modroles:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    const raw = interaction.fields.getTextInputValue('role_ids').trim()
    s.pending.mod_roles = raw ? raw.split(',').map(r => r.trim().replace(/\D/g, '')).filter(Boolean) : []
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

const mgeneral_adminroles = {
  customId: /^mgeneral_adminroles:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    const s   = getSession(uid, guildId, MODULE); if (!s) return
    const raw = interaction.fields.getTextInputValue('role_ids').trim()
    s.pending.admin_roles = raw ? raw.split(',').map(r => r.trim().replace(/\D/g, '')).filter(Boolean) : []
    setSession(uid, guildId, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

module.exports = [
  sgeneral_prefix, sgeneral_language, sgeneral_muterole,
  sgeneral_modroles, sgeneral_adminroles,
  sgeneral_logch, sgeneral_modch, sgeneral_casech, sgeneral_updatesch,
  sgeneral_save,
  mgeneral_prefix, mgeneral_language, mgeneral_muterole,
  mgeneral_modroles, mgeneral_adminroles,
  mgeneral_logch, mgeneral_modch, mgeneral_casech, mgeneral_updatesch
]
