'use strict'

const { ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const {
  getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayChannel, displayRole, displayBool, display
} = require('../../../shared/setupBuilder')
const { updateConfig } = require('../../../shared/cache')

const MODULE = 'tickets'

function panelFromSession (guild, uid, pending) {
  const p = pending
  const embed = buildSetupEmbed(guild, {
    title:       'Tickets Setup',
    description: 'Configure the ticket system. Click **Save** when done.',
    state:       'pending',
    fields: [
      { name: 'Ticket Category',  value: displayChannel(p.ticket_category),    inline: true },
      { name: 'Support Role',     value: displayRole(p.ticket_support_role),   inline: true },
      { name: 'Auto-close',       value: p.ticket_auto_close > 0 ? `${p.ticket_auto_close}h` : 'Disabled', inline: true },
    ]
  })

  const rows = buildRows([
    { id: `stickets_category:${uid}`,   label: 'Ticket Category'   },
    { id: `stickets_role:${uid}`,       label: 'Support Role'      },
    { id: `stickets_autoclose:${uid}`,  label: 'Auto-close Hours'  },
    { id: `stickets_save:${uid}`,       label: 'Save',              style: ButtonStyle.Success },
  ])

  return { embeds: [embed], components: rows }
}

function openModal (interaction, opts) {
  const modal = new ModalBuilder().setCustomId(opts.customId).setTitle(opts.title)
  const input = new TextInputBuilder()
    .setCustomId(opts.fieldId).setLabel(opts.label).setStyle(TextInputStyle.Short).setRequired(false)
  if (opts.placeholder) input.setPlaceholder(opts.placeholder)
  if (opts.value != null) input.setValue(String(opts.value))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

const stickets_category = {
  customId: /^stickets_category:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mtickets_category:${uid}`, title: 'Ticket Category',
      fieldId: 'channel_id', label: 'Category channel ID',
      placeholder: 'Paste category ID', value: s.pending.ticket_category ?? ''
    })
  }
}

const stickets_role = {
  customId: /^stickets_role:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mtickets_role:${uid}`, title: 'Support Role',
      fieldId: 'role_id', label: 'Role ID',
      placeholder: 'Paste role ID', value: s.pending.ticket_support_role ?? ''
    })
  }
}

const stickets_autoclose = {
  customId: /^stickets_autoclose:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, interaction.guild.id, MODULE)
    return openModal(interaction, {
      customId: `mtickets_autoclose:${uid}`, title: 'Auto-close',
      fieldId: 'hours', label: 'Close idle tickets after X hours (0 = off)',
      placeholder: '0', value: s.pending.ticket_auto_close ?? 0
    })
  }
}

const stickets_save = {
  customId: /^stickets_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE)) return
    const s = getSession(uid, guildId, MODULE); const p = s.pending

    updateConfig(client, guildId, {
      ticket_category:    p.ticket_category     ?? null,
      ticket_support_role: p.ticket_support_role ?? null,
      ticket_auto_close:  p.ticket_auto_close   ?? 0,
    })
    clearSession(uid, guildId, MODULE)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Tickets Setup', description: 'Ticket settings saved.', state: 'saved',
      fields: [
        { name: 'Category',   value: p.ticket_category    ? `<#${p.ticket_category}>`   : 'Not set', inline: true },
        { name: 'Support Role', value: p.ticket_support_role ? `<@&${p.ticket_support_role}>` : 'Not set', inline: true },
        { name: 'Auto-close', value: p.ticket_auto_close > 0 ? `${p.ticket_auto_close}h` : 'Disabled', inline: true }
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

const mtickets_category  = makeModalHandler(/^mtickets_category:/,  'ticket_category',     v => v.replace(/\D/g, '') || null)
const mtickets_role      = makeModalHandler(/^mtickets_role:/,      'ticket_support_role', v => v.replace(/\D/g, '') || null)
const mtickets_autoclose = makeModalHandler(/^mtickets_autoclose:/, 'ticket_auto_close',   v => parseInt(v) || 0)

module.exports = [
  stickets_category, stickets_role, stickets_autoclose, stickets_save,
  mtickets_category, mtickets_role, mtickets_autoclose
]
