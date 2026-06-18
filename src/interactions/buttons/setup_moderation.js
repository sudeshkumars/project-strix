'use strict'

const { ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const {
  getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayChannel, displayBool, display
} = require('../../../shared/setupBuilder')
const { updateConfig } = require('../../../shared/cache')

const MODULE = 'moderation'

function panelFromSession (guild, uid, pending) {
  const p = pending
  const embed = buildSetupEmbed(guild, {
    title:       'Moderation Setup',
    description: 'Configure moderation settings. Click **Save** when done.',
    state:       'pending',
    fields: [
      { name: 'Warn Threshold',  value: display(p.warn_threshold),              inline: true },
      { name: 'Warn Decay',      value: p.warn_decay_days ? `${p.warn_decay_days} days` : 'Not set', inline: true },
      { name: 'DM on Action',    value: displayBool(p.dm_on_action ?? 1),       inline: true },
      { name: 'Appeal Channel',  value: displayChannel(p.appeal_channel),       inline: true },
      { name: 'Case Channel',    value: displayChannel(p.case_channel),         inline: true },
      { name: 'Mod Channel',     value: displayChannel(p.mod_channel),          inline: true },
    ]
  })

  const rows = buildRows([
    { id: `smod_threshold:${uid}`,   label: 'Warn Threshold'   },
    { id: `smod_decay:${uid}`,       label: 'Warn Decay Days'  },
    { id: `smod_dm:${uid}`,          label: 'Toggle DM',        style: ButtonStyle.Secondary },
    { id: `smod_appeal:${uid}`,      label: 'Appeal Channel'   },
    { id: `smod_casech:${uid}`,      label: 'Case Channel'     },
    { id: `smod_modch:${uid}`,       label: 'Mod Channel'      },
    { id: `smod_save:${uid}`,        label: 'Save',             style: ButtonStyle.Success   },
  ])

  return { embeds: [embed], components: rows }
}

function openModal (interaction, opts) {
  const modal = new ModalBuilder().setCustomId(opts.customId).setTitle(opts.title)
  const input = new TextInputBuilder()
    .setCustomId(opts.fieldId).setLabel(opts.label)
    .setStyle(TextInputStyle.Short).setRequired(true)
  if (opts.placeholder) input.setPlaceholder(opts.placeholder)
  if (opts.value != null) input.setValue(String(opts.value))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

const smod_threshold = {
  customId: /^smod_threshold:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mmod_threshold:${uid}`, title: 'Warn Threshold',
      fieldId: 'value', label: 'Auto-action after X warning points', placeholder: '3', value: s.pending.warn_threshold ?? 3
    })
  }
}

const smod_decay = {
  customId: /^smod_decay:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mmod_decay:${uid}`, title: 'Warn Decay Days',
      fieldId: 'value', label: 'Warnings expire after X days', placeholder: '30', value: s.pending.warn_decay_days ?? 30
    })
  }
}

const smod_dm = {
  customId: /^smod_dm:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    s.pending.dm_on_action = s.pending.dm_on_action ? 0 : 1
    setSession(uid, interaction.guild.id, MODULE, s)
    await interaction.editReply(panelFromSession(interaction.guild, uid, s.pending))
  }
}

function makeChannelButton (base, title, field) {
  return {
    customId: new RegExp(`^${base}:`),
    async execute (client, interaction) {
      const uid = interaction.user.id
      if (await guardSession(interaction, MODULE)) return
      const s = getSession(uid, interaction.guild.id, MODULE)
      return openModal(interaction, {
        customId: `m${base}:${uid}`, title, fieldId: 'channel_id',
        label: 'Channel ID', placeholder: 'Paste channel ID', value: s.pending[field] ?? ''
      })
    }
  }
}

const smod_appeal = makeChannelButton('smod_appeal', 'Appeal Channel', 'appeal_channel')
const smod_casech = makeChannelButton('smod_casech', 'Case Channel',   'case_channel')
const smod_modch  = makeChannelButton('smod_modch',  'Mod Channel',    'mod_channel')

const smod_save = {
  customId: /^smod_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guildId, MODULE); const p = s.pending

    updateConfig(client, guildId, {
      warn_threshold:  p.warn_threshold  ?? 3,
      warn_decay_days: p.warn_decay_days ?? 30,
      dm_on_action:    p.dm_on_action    ?? 1,
      appeal_channel:  p.appeal_channel  ?? null,
      case_channel:    p.case_channel    ?? null,
      mod_channel:     p.mod_channel     ?? null,
    })
    clearSession(uid, guildId, MODULE)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Moderation Setup', description: 'Moderation settings saved.', state: 'saved',
      fields: [
        { name: 'Warn Threshold', value: String(p.warn_threshold ?? 3), inline: true },
        { name: 'DM on Action',   value: p.dm_on_action ? 'Enabled' : 'Disabled', inline: true }
      ]
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
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

const mmod_threshold = makeModalHandler(/^mmod_threshold:/, 'warn_threshold',  v => parseInt(v) || 3)
const mmod_decay     = makeModalHandler(/^mmod_decay:/,     'warn_decay_days', v => parseInt(v) || 30)
const mmod_appeal    = makeModalHandler(/^msmod_appeal:/,   'appeal_channel',  v => v.replace(/\D/g, '') || null)
const mmod_casech    = makeModalHandler(/^msmod_casech:/,   'case_channel',    v => v.replace(/\D/g, '') || null)
const mmod_modch     = makeModalHandler(/^msmod_modch:/,    'mod_channel',     v => v.replace(/\D/g, '') || null)

module.exports = [
  smod_threshold, smod_decay, smod_dm,
  smod_appeal, smod_casech, smod_modch,
  smod_save,
  mmod_threshold, mmod_decay, mmod_appeal, mmod_casech, mmod_modch
]
