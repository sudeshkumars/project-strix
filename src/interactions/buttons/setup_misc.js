'use strict'

// ─── AutoMod Setup ────────────────────────────────────────────────────────────
const { ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js')
const {
  getSession, setSession, clearSession, guardSession,
  buildSetupEmbed, buildRows, displayBool
} = require('../../../shared/setupBuilder')
const { updateConfig, isModuleEnabled } = require('../../../shared/cache')
const db = require('../../../shared/db')

// ════════════════════════════════════════════════════════════════
// AUTOMOD
// ════════════════════════════════════════════════════════════════
const MODULE_AM = 'automod'

function automodPanel (guild, uid, pending, rules) {
  const modules   = pending.modules ?? {}
  const enabled   = modules.automod === true || modules.automod === 1
  const ruleCount = rules?.length ?? 0

  const embed = buildSetupEmbed(guild, {
    title:       'AutoMod Setup',
    description: 'Manage automated moderation rules.',
    state:       'pending',
    fields: [
      { name: 'Status',         value: enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Active Rules',   value: String(ruleCount),                 inline: true },
    ]
  })

  const rows = buildRows([
    { id: `sautomod_toggle:${uid}`,  label: enabled ? 'Disable AutoMod' : 'Enable AutoMod', style: ButtonStyle.Secondary },
    { id: `sautomod_add:${uid}`,     label: 'Add Rule'    },
    { id: `sautomod_list:${uid}`,    label: 'View Rules',  style: ButtonStyle.Secondary },
    { id: `sautomod_save:${uid}`,    label: 'Save',        style: ButtonStyle.Success   },
  ])

  return { embeds: [embed], components: rows }
}

const sautomod_toggle = {
  customId: /^sautomod_toggle:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE_AM)) return
    const s = getSession(uid, interaction.guild.id, MODULE_AM)
    const modules = s.pending.modules ?? {}
    modules.automod = !modules.automod
    s.pending.modules = modules
    setSession(uid, interaction.guild.id, MODULE_AM, s)
    const rules = db.getAutomodRules(interaction.guild.id)
    await interaction.editReply(automodPanel(interaction.guild, uid, s.pending, rules))
  }
}

const sautomod_add = {
  customId: /^sautomod_add:/,
  async execute (client, interaction) {
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE_AM)) return
    const modal = new ModalBuilder().setCustomId(`mautomod_add:${uid}`).setTitle('Add AutoMod Rule')
    const triggerInput = new TextInputBuilder().setCustomId('trigger').setLabel('Trigger type (spam/mentions/links/invites/words/caps)').setStyle(TextInputStyle.Short).setRequired(true)
    const actionInput  = new TextInputBuilder().setCustomId('action').setLabel('Action (delete/warn/mute/kick/ban)').setStyle(TextInputStyle.Short).setRequired(true)
    const threshInput  = new TextInputBuilder().setCustomId('threshold').setLabel('Threshold count').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('5')
    modal.addComponents(
      new ActionRowBuilder().addComponents(triggerInput),
      new ActionRowBuilder().addComponents(actionInput),
      new ActionRowBuilder().addComponents(threshInput)
    )
    return interaction.showModal(modal)
  }
}

const sautomod_list = {
  customId: /^sautomod_list:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id
    if (await guardSession(interaction, MODULE_AM)) return
    const rules = db.getAutomodRules(interaction.guild.id)
    const lines = rules.length
      ? rules.map(r => `#${r.id} ${r.trigger_type} → ${r.action} (threshold: ${r.threshold ?? 'n/a'}) [${r.enabled ? 'on' : 'off'}]`).join('\n')
      : 'No rules configured.'
    await interaction.followUp({ content: `\`\`\`\n${lines}\n\`\`\``, flags: MessageFlags.Ephemeral })
  }
}

const sautomod_save = {
  customId: /^sautomod_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE_AM)) return
    const s = getSession(uid, guildId, MODULE_AM); const p = s.pending

    updateConfig(client, guildId,
      { modules: JSON.stringify(p.modules ?? {}) },
      { modules: p.modules ?? {} }
    )
    clearSession(uid, guildId, MODULE_AM)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'AutoMod Setup', description: 'AutoMod settings saved.', state: 'saved',
      fields: [{ name: 'Status', value: (p.modules?.automod) ? 'Enabled' : 'Disabled', inline: true }]
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

const mautomod_add = {
  customId: /^mautomod_add:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE_AM)) return

    const trigger   = interaction.fields.getTextInputValue('trigger').trim().toLowerCase()
    const action    = interaction.fields.getTextInputValue('action').trim().toLowerCase()
    const threshold = parseInt(interaction.fields.getTextInputValue('threshold')) || null

    const VALID_TRIGGERS = ['spam', 'mentions', 'links', 'invites', 'words', 'caps', 'newlines', 'emoji', 'regex']
    const VALID_ACTIONS  = ['delete', 'warn', 'mute', 'kick', 'ban']

    if (!VALID_TRIGGERS.includes(trigger) || !VALID_ACTIONS.includes(action)) {
      return interaction.followUp({ content: 'Invalid trigger or action type.', flags: MessageFlags.Ephemeral })
    }

    db.createAutomodRule(guildId, { trigger_type: trigger, action, threshold })
    const s     = getSession(uid, guildId, MODULE_AM)
    const rules = db.getAutomodRules(guildId)
    await interaction.editReply(automodPanel(interaction.guild, uid, s.pending, rules))
  }
}

// ════════════════════════════════════════════════════════════════
// COMMUNITY (starboard + suggestions)
// ════════════════════════════════════════════════════════════════
const MODULE_COM = 'community'

function communityPanel (guild, uid, pending) {
  const p = pending
  const embed = buildSetupEmbed(guild, {
    title:       'Community Setup',
    description: 'Configure community features.',
    state:       'pending',
    fields: [
      { name: 'Starboard Channel',   value: p.starboard_channel  ? `<#${p.starboard_channel}>` : 'Not set', inline: true },
      { name: 'Star Threshold',      value: String(p.star_threshold ?? 3),                                   inline: true },
      { name: 'Star Emoji',          value: p.star_emoji ?? '⭐',                                            inline: true },
      { name: 'Suggestions Channel', value: p.suggestions_channel ? `<#${p.suggestions_channel}>` : 'Not set', inline: true },
      { name: 'Birthday Channel',    value: p.birthday_channel   ? `<#${p.birthday_channel}>` : 'Not set',  inline: true },
    ]
  })

  const rows = buildRows([
    { id: `scommunity_starboard:${uid}`,    label: 'Starboard Channel'   },
    { id: `scommunity_threshold:${uid}`,    label: 'Star Threshold'      },
    { id: `scommunity_emoji:${uid}`,        label: 'Star Emoji'          },
    { id: `scommunity_suggestions:${uid}`,  label: 'Suggestions Channel' },
    { id: `scommunity_birthday:${uid}`,     label: 'Birthday Channel'    },
    { id: `scommunity_save:${uid}`,         label: 'Save',                style: ButtonStyle.Success },
  ])

  return { embeds: [embed], components: rows }
}

function openSingleModal (interaction, opts) {
  const modal = new ModalBuilder().setCustomId(opts.customId).setTitle(opts.title)
  const input = new TextInputBuilder().setCustomId(opts.fieldId).setLabel(opts.label).setStyle(TextInputStyle.Short).setRequired(false)
  if (opts.placeholder) input.setPlaceholder(opts.placeholder)
  if (opts.value != null) input.setValue(String(opts.value))
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  return interaction.showModal(modal)
}

function makeCommunityBtn (base, title, field, isChannel = true) {
  return {
    customId: new RegExp(`^${base}:`),
    async execute (client, interaction) {
      const uid = interaction.user.id
      if (await guardSession(interaction, MODULE_COM)) return
      const s = getSession(uid, interaction.guild.id, MODULE_COM)
      return openSingleModal(interaction, {
        customId: `m${base}:${uid}`, title, fieldId: isChannel ? 'channel_id' : 'value',
        label: isChannel ? 'Channel ID' : title,
        placeholder: isChannel ? 'Paste channel ID' : '',
        value: s.pending[field] ?? ''
      })
    }
  }
}

const scommunity_starboard   = makeCommunityBtn('scommunity_starboard',   'Starboard Channel',   'starboard_channel',   true)
const scommunity_suggestions = makeCommunityBtn('scommunity_suggestions', 'Suggestions Channel', 'suggestions_channel', true)
const scommunity_birthday    = makeCommunityBtn('scommunity_birthday',    'Birthday Channel',    'birthday_channel',    true)
const scommunity_threshold   = makeCommunityBtn('scommunity_threshold',   'Star Threshold',      'star_threshold',      false)
const scommunity_emoji       = makeCommunityBtn('scommunity_emoji',       'Star Emoji',          'star_emoji',          false)

const scommunity_save = {
  customId: /^scommunity_save:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    if (await guardSession(interaction, MODULE_COM)) return
    const s = getSession(uid, guildId, MODULE_COM); const p = s.pending

    updateConfig(client, guildId, {
      starboard_channel:   p.starboard_channel   ?? null,
      star_threshold:      p.star_threshold      ?? 3,
      star_emoji:          p.star_emoji          ?? '⭐',
      suggestions_channel: p.suggestions_channel ?? null,
      birthday_channel:    p.birthday_channel    ?? null,
    })
    clearSession(uid, guildId, MODULE_COM)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Community Setup', description: 'Community settings saved.', state: 'saved',
      fields: [
        { name: 'Starboard',    value: p.starboard_channel   ? `<#${p.starboard_channel}>`   : 'Not set', inline: true },
        { name: 'Suggestions',  value: p.suggestions_channel ? `<#${p.suggestions_channel}>` : 'Not set', inline: true },
      ]
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

function makeCommunityModal (pattern, field, transform) {
  return {
    customId: pattern,
    async execute (client, interaction) {
      await interaction.deferUpdate()
      const uid = interaction.user.id; const guildId = interaction.guild.id
      const s   = getSession(uid, guildId, MODULE_COM); if (!s) return
      const raw = interaction.fields.getTextInputValue(interaction.fields.fields.first().customId)
      s.pending[field] = transform ? transform(raw) : raw.trim()
      setSession(uid, guildId, MODULE_COM, s)
      await interaction.editReply(communityPanel(interaction.guild, uid, s.pending))
    }
  }
}

const mscommunity_starboard   = makeCommunityModal(/^mscommunity_starboard:/,   'starboard_channel',   v => v.replace(/\D/g, '') || null)
const mscommunity_suggestions = makeCommunityModal(/^mscommunity_suggestions:/, 'suggestions_channel', v => v.replace(/\D/g, '') || null)
const mscommunity_birthday    = makeCommunityModal(/^mscommunity_birthday:/,    'birthday_channel',    v => v.replace(/\D/g, '') || null)
const mscommunity_threshold   = makeCommunityModal(/^mscommunity_threshold:/,   'star_threshold',      v => parseInt(v) || 3)
const mscommunity_emoji       = makeCommunityModal(/^mscommunity_emoji:/,       'star_emoji',          v => v.trim() || '⭐')

// ════════════════════════════════════════════════════════════════
// SCHEDULER
// ════════════════════════════════════════════════════════════════
const MODULE_SCH = 'scheduler'

function schedulerPanel (guild, uid, pending, posts) {
  const count = posts?.length ?? 0
  const embed = buildSetupEmbed(guild, {
    title:       'Scheduler Setup',
    description: 'Manage scheduled messages.',
    state:       'pending',
    fields: [
      { name: 'Active Scheduled Posts', value: String(count), inline: true }
    ]
  })

  const rows = buildRows([
    { id: `sscheduler_add:${uid}`,   label: 'Add Scheduled Post' },
    { id: `sscheduler_list:${uid}`,  label: 'View Posts',         style: ButtonStyle.Secondary },
    { id: `sscheduler_done:${uid}`,  label: 'Done',               style: ButtonStyle.Success   },
  ])

  return { embeds: [embed], components: rows }
}

const sscheduler_add = {
  customId: /^sscheduler_add:/,
  async execute (client, interaction) {
    if (await guardSession(interaction, MODULE_SCH)) return
    const uid   = interaction.user.id
    const modal = new ModalBuilder().setCustomId(`mscheduler_add:${uid}`).setTitle('Add Scheduled Post')
    const chInput  = new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID').setStyle(TextInputStyle.Short).setRequired(true)
    const cronInput = new TextInputBuilder().setCustomId('cron').setLabel('Cron expression (e.g. 0 9 * * 1)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('0 9 * * 1')
    const msgInput  = new TextInputBuilder().setCustomId('message').setLabel('Message content').setStyle(TextInputStyle.Paragraph).setRequired(true)
    modal.addComponents(
      new ActionRowBuilder().addComponents(chInput),
      new ActionRowBuilder().addComponents(cronInput),
      new ActionRowBuilder().addComponents(msgInput)
    )
    return interaction.showModal(modal)
  }
}

const sscheduler_list = {
  customId: /^sscheduler_list:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    if (await guardSession(interaction, MODULE_SCH)) return
    const posts = db.getScheduledPosts(interaction.guild.id)
    const lines = posts.length
      ? posts.map(p => `#${p.id} <#${p.channel_id}> \`${p.cron}\` — ${(p.content ?? '').slice(0, 40)}…`).join('\n')
      : 'No scheduled posts.'
    await interaction.followUp({ content: `\`\`\`\n${lines}\n\`\`\``, flags: MessageFlags.Ephemeral })
  }
}

const sscheduler_done = {
  customId: /^sscheduler_done:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid = interaction.user.id; const guildId = interaction.guild.id
    clearSession(uid, guildId, MODULE_SCH)
    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Scheduler Setup', description: 'Scheduler configuration complete.', state: 'saved', fields: []
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

const mscheduler_add = {
  customId: /^mscheduler_add:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const guildId  = interaction.guild.id
    const channelId = interaction.fields.getTextInputValue('channel_id').replace(/\D/g, '')
    const cron      = interaction.fields.getTextInputValue('cron').trim()
    const message   = interaction.fields.getTextInputValue('message').trim()

    if (!channelId || !cron || !message) return

    db.createScheduledPost(guildId, { channel_id: channelId, cron, content: message })

    const uid   = interaction.user.id
    const s     = getSession(uid, guildId, MODULE_SCH)
    const posts = db.getScheduledPosts(guildId)
    await interaction.editReply(schedulerPanel(interaction.guild, uid, s?.pending ?? {}, posts))
  }
}

// ════════════════════════════════════════════════════════════════
// HUB: open each module panel from /setup hub buttons
// ════════════════════════════════════════════════════════════════
const { setSession: _setSession } = require('../../../shared/setupBuilder')

function makeHubHandler (module, label, panelFn) {
  return {
    customId: new RegExp(`^setup_hub_${module}:`),
    async execute (client, interaction) {
      await interaction.deferUpdate()
      const uid     = interaction.user.id
      const guildId = interaction.guild.id
      const config  = interaction.guildConfig ?? {}

      setSession(uid, guildId, module, { pending: { ...config } })

      let reply
      if (panelFn === 'automod') {
        const rules = db.getAutomodRules(guildId)
        reply = automodPanel(interaction.guild, uid, config, rules)
      } else if (panelFn === 'community') {
        reply = communityPanel(interaction.guild, uid, config)
      } else if (panelFn === 'scheduler') {
        const posts = db.getScheduledPosts(guildId)
        reply = schedulerPanel(interaction.guild, uid, config, posts)
      } else {
        reply = panelFn(interaction.guild, uid, config)
      }

      await interaction.editReply(reply)
    }
  }
}

// Import panel builders from sibling files
const { buildRows: _br, buildSetupEmbed: _bse } = require('../../../shared/setupBuilder')

// Lazy-load sibling panels to avoid circular deps
function generalPanel (guild, uid, p) {
  const { buildRows, buildSetupEmbed, displayChannel, displayRole, display } = require('../../../shared/setupBuilder')
  const modRoles   = Array.isArray(p.mod_roles)   ? p.mod_roles.map(r   => `<@&${r}>`).join(', ')  || 'None' : 'None'
  const adminRoles = Array.isArray(p.admin_roles)  ? p.admin_roles.map(r => `<@&${r}>`).join(', ')  || 'None' : 'None'
  const embed = buildSetupEmbed(guild, {
    title: 'General Setup', description: 'Configure core bot settings. Click **Save** when done.',
    state: 'pending',
    fields: [
      { name: 'Prefix',          value: display(p.prefix),               inline: true },
      { name: 'Mute Role',       value: displayRole(p.mute_role),        inline: true },
      { name: 'Log Channel',     value: displayChannel(p.log_channel),   inline: true },
      { name: 'Mod Roles',       value: modRoles,                        inline: false },
      { name: 'Admin Roles',     value: adminRoles,                      inline: false },
    ]
  })
  const rows = buildRows([
    { id: `sgeneral_prefix:${uid}`, label: 'Set Prefix' },
    { id: `sgeneral_muterole:${uid}`, label: 'Mute Role' },
    { id: `sgeneral_modroles:${uid}`, label: 'Mod Roles' },
    { id: `sgeneral_adminroles:${uid}`, label: 'Admin Roles' },
    { id: `sgeneral_logch:${uid}`, label: 'Log Channel' },
    { id: `sgeneral_modch:${uid}`, label: 'Mod Channel' },
    { id: `sgeneral_casech:${uid}`, label: 'Case Channel' },
    { id: `sgeneral_updatesch:${uid}`, label: 'Updates Channel' },
    { id: `sgeneral_save:${uid}`, label: 'Save', style: ButtonStyle.Success },
  ])
  return { embeds: [embed], components: rows }
}

const setup_hub_general    = makeHubHandler('general',    'General',    generalPanel)
const setup_hub_automod    = makeHubHandler('automod',    'AutoMod',    'automod')
const setup_hub_community  = makeHubHandler('community',  'Community',  'community')
const setup_hub_scheduler  = makeHubHandler('scheduler',  'Scheduler',  'scheduler')

// Reset all
const setup_hub_reset = {
  customId: /^setup_hub_reset:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const { buildRows, buildSetupEmbed } = require('../../../shared/setupBuilder')
    const { ButtonStyle } = require('discord.js')

    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Reset All Settings',
      description: 'This will wipe all Stryx configuration for this server. This cannot be undone.',
      state:       'error',
      fields: []
    })
    const rows = buildRows([
      { id: `setup_reset_confirm:${uid}`, label: 'Yes, reset everything', style: ButtonStyle.Danger     },
      { id: `setup_reset_cancel:${uid}`,  label: 'Cancel',                 style: ButtonStyle.Secondary  },
    ])
    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

const setup_reset_confirm = {
  customId: /^setup_reset_confirm:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const guildId = interaction.guild.id
    db.resetGuildConfig(guildId)
    const { reloadGuild } = require('../../../shared/cache')
    reloadGuild(client, guildId)

    const savedEmbed = buildSetupEmbed(interaction.guild, {
      title: 'Reset Complete', description: 'All settings have been reset to defaults.', state: 'saved', fields: []
    })
    await interaction.editReply({ embeds: [savedEmbed], components: [] })
  }
}

const setup_reset_cancel = {
  customId: /^setup_reset_cancel:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    await interaction.editReply({
      embeds: [buildSetupEmbed(interaction.guild, {
        title: 'Reset Cancelled', description: 'No changes were made.', state: 'default', fields: []
      })],
      components: []
    })
  }
}

module.exports = [
  // AutoMod
  sautomod_toggle, sautomod_add, sautomod_list, sautomod_save, mautomod_add,
  // Community
  scommunity_starboard, scommunity_suggestions, scommunity_birthday,
  scommunity_threshold, scommunity_emoji, scommunity_save,
  mscommunity_starboard, mscommunity_suggestions, mscommunity_birthday,
  mscommunity_threshold, mscommunity_emoji,
  // Scheduler
  sscheduler_add, sscheduler_list, sscheduler_done, mscheduler_add,
  // Hub
  setup_hub_general, setup_hub_automod, setup_hub_community, setup_hub_scheduler,
  setup_hub_reset, setup_reset_confirm, setup_reset_cancel
]
