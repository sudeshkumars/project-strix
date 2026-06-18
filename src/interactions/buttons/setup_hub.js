'use strict'

// ─── Hub handlers ─────────────────────────────────────────────────────────────
// These handle the module buttons on the /setup hub embed.
// Each opens the relevant module's panel and seeds a session.

const { ButtonStyle, MessageFlags } = require('discord.js')
const {
  setSession, buildSetupEmbed, buildRows,
  displayChannel, displayRole, displayBool, display
} = require('../../../shared/setupBuilder')

// ─── Welcome hub ─────────────────────────────────────────────────────────────
const setup_hub_welcome = {
  customId: /^setup_hub_welcome:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig ?? {}

    setSession(uid, guildId, 'welcome', {
      pending: {
        welcome_channel:     config.welcome_channel     ?? null,
        goodbye_channel:     config.goodbye_channel     ?? null,
        welcome_style:       config.welcome_style       ?? 'embed',
        welcome_message:     config.welcome_message     ?? 'Welcome {user} to {server}!',
        goodbye_message:     config.goodbye_message     ?? '{username} has left {server}.',
        welcome_color:       config.welcome_color       ?? '#5865F2',
        welcome_bg_url:      config.welcome_bg_url      ?? null,
        welcome_bg_source:   config.welcome_bg_source   ?? 'default',
        welcome_show_avatar: config.welcome_show_avatar ?? 1,
        welcome_avatar_src:  config.welcome_avatar_src  ?? 'user',
        welcome_dm:          config.welcome_dm          ?? 0,
        welcome_dm_message:  config.welcome_dm_message  ?? null,
        welcome_autorole:    config.welcome_autorole    ?? []
      }
    })

    const p = config
    const autoroles = Array.isArray(p.welcome_autorole)
      ? p.welcome_autorole.map(r => `<@&${r}>`).join(', ') || 'None'
      : 'None'

    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Welcome Setup',
      description: 'Configure welcome and goodbye messages. Click **Save** when done.',
      fields: [
        { name: 'Welcome Channel', value: displayChannel(p.welcome_channel),  inline: true  },
        { name: 'Goodbye Channel', value: displayChannel(p.goodbye_channel),  inline: true  },
        { name: 'Style',           value: p.welcome_style  ?? 'embed',        inline: true  },
        { name: 'Background',      value: p.welcome_bg_source ?? 'default',   inline: true  },
        { name: 'Avatar',          value: displayBool(p.welcome_show_avatar ?? 1), inline: true },
        { name: 'Avatar Source',   value: p.welcome_avatar_src ?? 'user',     inline: true  },
        { name: 'DM on Join',      value: displayBool(p.welcome_dm),          inline: true  },
        { name: 'Auto Role',       value: autoroles,                           inline: true  },
        { name: 'Color',           value: display(p.welcome_color),           inline: true  },
        { name: 'Welcome Message', value: `\`${p.welcome_message ?? 'Welcome {user} to {server}!'}\``, inline: false },
        { name: 'Goodbye Message', value: `\`${p.goodbye_message ?? '{username} has left {server}.'}\``, inline: false },
      ]
    })

    const rows = buildRows([
      { id: `swelcome_channel:${uid}`,    label: 'Welcome Channel'  },
      { id: `swelcome_goodbye:${uid}`,    label: 'Goodbye Channel'  },
      { id: `swelcome_message:${uid}`,    label: 'Welcome Message'  },
      { id: `swelcome_goodbyemsg:${uid}`, label: 'Goodbye Message'  },
      { id: `swelcome_style:${uid}`,      label: 'Cycle Style',      style: ButtonStyle.Secondary },
      { id: `swelcome_bg:${uid}`,         label: 'Background'       },
      { id: `swelcome_color:${uid}`,      label: 'Set Color'        },
      { id: `swelcome_avatar:${uid}`,     label: 'Toggle Avatar',    style: ButtonStyle.Secondary },
      { id: `swelcome_avatarsrc:${uid}`,  label: 'Avatar Source',    style: ButtonStyle.Secondary },
      { id: `swelcome_dm:${uid}`,         label: 'Toggle DM',        style: ButtonStyle.Secondary },
      { id: `swelcome_dmmessage:${uid}`,  label: 'DM Message'       },
      { id: `swelcome_autorole:${uid}`,   label: 'Auto Role'        },
      { id: `swelcome_test:${uid}`,       label: 'Preview',          style: ButtonStyle.Secondary },
      { id: `swelcome_save:${uid}`,       label: 'Save',             style: ButtonStyle.Success   },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

// ─── Moderation hub ──────────────────────────────────────────────────────────
const setup_hub_moderation = {
  customId: /^setup_hub_moderation:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig ?? {}

    setSession(uid, guildId, 'moderation', {
      pending: {
        warn_threshold:  config.warn_threshold  ?? 3,
        warn_decay_days: config.warn_decay_days ?? 30,
        dm_on_action:    config.dm_on_action    ?? 1,
        appeal_channel:  config.appeal_channel  ?? null,
        case_channel:    config.case_channel    ?? null,
        mod_channel:     config.mod_channel     ?? null,
      }
    })

    const p = config
    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Moderation Setup',
      description: 'Configure moderation settings. Click **Save** when done.',
      fields: [
        { name: 'Warn Threshold',  value: display(p.warn_threshold ?? 3),                     inline: true },
        { name: 'Warn Decay',      value: `${p.warn_decay_days ?? 30} days`,                  inline: true },
        { name: 'DM on Action',    value: displayBool(p.dm_on_action ?? 1),                   inline: true },
        { name: 'Appeal Channel',  value: displayChannel(p.appeal_channel),                   inline: true },
        { name: 'Case Channel',    value: displayChannel(p.case_channel),                     inline: true },
        { name: 'Mod Channel',     value: displayChannel(p.mod_channel),                      inline: true },
      ]
    })

    const rows = buildRows([
      { id: `smod_threshold:${uid}`, label: 'Warn Threshold'                                       },
      { id: `smod_decay:${uid}`,     label: 'Warn Decay Days'                                      },
      { id: `smod_dm:${uid}`,        label: 'Toggle DM',       style: ButtonStyle.Secondary        },
      { id: `smod_appeal:${uid}`,    label: 'Appeal Channel'                                       },
      { id: `smod_casech:${uid}`,    label: 'Case Channel'                                         },
      { id: `smod_modch:${uid}`,     label: 'Mod Channel'                                          },
      { id: `smod_save:${uid}`,      label: 'Save',            style: ButtonStyle.Success          },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

// ─── Logging hub ─────────────────────────────────────────────────────────────
const setup_hub_logging = {
  customId: /^setup_hub_logging:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig ?? {}

    const routes     = config.log_routes          ?? {}
    const ignRoles   = config.log_ignore_roles    ?? []
    const ignChs     = config.log_ignore_channels ?? []

    setSession(uid, guildId, 'logging', {
      pending: {
        log_channel:          config.log_channel ?? null,
        log_routes:           routes,
        log_ignore_roles:     ignRoles,
        log_ignore_channels:  ignChs,
      }
    })

    const EVENT_TYPES = [
      'message_edit', 'message_delete', 'bulk_delete',
      'member_join', 'member_leave', 'member_update',
      'invite', 'role_change', 'channel_change',
      'voice', 'mod_action', 'ban', 'unban', 'automod'
    ]

    const fields = EVENT_TYPES.map(e => ({
      name:   e,
      value:  routes[e] ? `<#${routes[e]}>` : 'Not set',
      inline: true
    }))
    fields.push(
      { name: 'Ignored Roles',    value: ignRoles.length ? ignRoles.map(r => `<@&${r}>`).join(', ') : 'None', inline: false },
      { name: 'Ignored Channels', value: ignChs.length   ? ignChs.map(c => `<#${c}>`).join(', ')   : 'None', inline: false }
    )

    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Logging Setup',
      description: 'Route each event to a channel. Leave blank to disable that event log.',
      fields
    })

    const rows = buildRows([
      { id: `slogs_routes:${uid}`,   label: 'Set Event Routes'                      },
      { id: `slogs_fallback:${uid}`, label: 'Fallback Channel'                      },
      { id: `slogs_ignore:${uid}`,   label: 'Ignore Roles / Channels'               },
      { id: `slogs_clear:${uid}`,    label: 'Clear All Routes', style: ButtonStyle.Danger   },
      { id: `slogs_save:${uid}`,     label: 'Save',             style: ButtonStyle.Success  },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

// ─── Tickets hub ─────────────────────────────────────────────────────────────
const setup_hub_tickets = {
  customId: /^setup_hub_tickets:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig ?? {}

    setSession(uid, guildId, 'tickets', {
      pending: {
        ticket_category:     config.ticket_category     ?? null,
        ticket_support_role: config.ticket_support_role ?? null,
        ticket_auto_close:   config.ticket_auto_close   ?? 0,
      }
    })

    const p = config
    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Tickets Setup',
      description: 'Configure the ticket system. Click **Save** when done.',
      fields: [
        { name: 'Ticket Category', value: displayChannel(p.ticket_category),                              inline: true },
        { name: 'Support Role',    value: displayRole(p.ticket_support_role),                             inline: true },
        { name: 'Auto-close',      value: p.ticket_auto_close > 0 ? `${p.ticket_auto_close}h` : 'Disabled', inline: true },
      ]
    })

    const rows = buildRows([
      { id: `stickets_category:${uid}`,  label: 'Ticket Category'                      },
      { id: `stickets_role:${uid}`,      label: 'Support Role'                         },
      { id: `stickets_autoclose:${uid}`, label: 'Auto-close Hours'                     },
      { id: `stickets_save:${uid}`,      label: 'Save',           style: ButtonStyle.Success },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

// ─── Leveling hub ─────────────────────────────────────────────────────────────
const setup_hub_leveling = {
  customId: /^setup_hub_leveling:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig ?? {}

    const bl = config.xp_blacklist ?? { roles: [], channels: [] }

    setSession(uid, guildId, 'leveling', {
      pending: {
        xp_min:          config.xp_min          ?? 15,
        xp_max:          config.xp_max          ?? 25,
        xp_cooldown:     config.xp_cooldown     ?? 60,
        levelup_channel: config.levelup_channel ?? null,
        levelup_message: config.levelup_message ?? 'GG {user}, you reached level {level}!',
        xp_blacklist:    bl,
      }
    })

    const p      = config
    const blRoles = Array.isArray(bl.roles)    ? bl.roles.map(r    => `<@&${r}>`).join(', ')  || 'None' : 'None'
    const blChs   = Array.isArray(bl.channels) ? bl.channels.map(c => `<#${c}>`).join(', ')   || 'None' : 'None'

    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Leveling Setup',
      description: 'Configure XP and leveling. Click **Save** when done.',
      fields: [
        { name: 'XP per Message',     value: `${p.xp_min ?? 15} – ${p.xp_max ?? 25}`,                       inline: true  },
        { name: 'XP Cooldown',        value: `${p.xp_cooldown ?? 60}s`,                                      inline: true  },
        { name: 'Level-up Channel',   value: displayChannel(p.levelup_channel),                              inline: true  },
        { name: 'Level-up Message',   value: `\`${p.levelup_message ?? 'GG {user}, you reached level {level}!'}\``, inline: false },
        { name: 'Blacklist Roles',    value: blRoles,                                                         inline: true  },
        { name: 'Blacklist Channels', value: blChs,                                                           inline: true  },
      ]
    })

    const rows = buildRows([
      { id: `slevel_xprange:${uid}`,   label: 'XP Range'                                       },
      { id: `slevel_cooldown:${uid}`,  label: 'Cooldown'                                        },
      { id: `slevel_channel:${uid}`,   label: 'Level-up Channel'                               },
      { id: `slevel_message:${uid}`,   label: 'Level-up Message'                               },
      { id: `slevel_blacklist:${uid}`, label: 'Blacklist'                                       },
      { id: `slevel_save:${uid}`,      label: 'Save',            style: ButtonStyle.Success     },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

// ─── Roles hub ────────────────────────────────────────────────────────────────
// Roles panels are managed via /rolepanel — hub just informs the user
const setup_hub_roles = {
  customId: /^setup_hub_roles:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const embed = buildSetupEmbed(interaction.guild, {
      title:       'Roles',
      description: 'Role panels are managed with `/rolepanel`.\n\n`/rolepanel create` — create a new panel\n`/rolepanel post` — post it to a channel\n`/autorole add` — assign a role to all new members',
      fields: []
    })
    await interaction.editReply({ embeds: [embed], components: [] })
  }
}

// ─── General hub ─────────────────────────────────────────────────────────────
const setup_hub_general = {
  customId: /^setup_hub_general:/,
  async execute (client, interaction) {
    await interaction.deferUpdate()
    const uid     = interaction.user.id
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig ?? {}

    setSession(uid, guildId, 'general', {
      pending: {
        prefix:             config.prefix             ?? '!',
        language:           config.language           ?? 'en',
        mute_role:          config.mute_role          ?? null,
        mod_roles:          config.mod_roles          ?? [],
        admin_roles:        config.admin_roles        ?? [],
        log_channel:        config.log_channel        ?? null,
        mod_channel:        config.mod_channel        ?? null,
        case_channel:       config.case_channel       ?? null,
        updates_channel_id: config.updates_channel_id ?? null,
      }
    })

    const p        = config
    const modRoles = Array.isArray(p.mod_roles)   ? p.mod_roles.map(r   => `<@&${r}>`).join(', ')  || 'None' : 'None'
    const admRoles = Array.isArray(p.admin_roles)  ? p.admin_roles.map(r => `<@&${r}>`).join(', ')  || 'None' : 'None'

    const embed = buildSetupEmbed(interaction.guild, {
      title:       'General Setup',
      description: 'Configure core bot settings. Click **Save** when done.',
      fields: [
        { name: 'Prefix',          value: display(p.prefix ?? '!'),            inline: true  },
        { name: 'Language',        value: display(p.language ?? 'en'),         inline: true  },
        { name: 'Mute Role',       value: displayRole(p.mute_role),            inline: true  },
        { name: 'Log Channel',     value: displayChannel(p.log_channel),       inline: true  },
        { name: 'Mod Channel',     value: displayChannel(p.mod_channel),       inline: true  },
        { name: 'Case Channel',    value: displayChannel(p.case_channel),      inline: true  },
        { name: 'Updates Channel', value: displayChannel(p.updates_channel_id),inline: true  },
        { name: 'Mod Roles',       value: modRoles,                            inline: false },
        { name: 'Admin Roles',     value: admRoles,                            inline: false },
      ]
    })

    const rows = buildRows([
      { id: `sgeneral_prefix:${uid}`,     label: 'Set Prefix'       },
      { id: `sgeneral_language:${uid}`,   label: 'Set Language'     },
      { id: `sgeneral_muterole:${uid}`,   label: 'Mute Role'        },
      { id: `sgeneral_modroles:${uid}`,   label: 'Mod Roles'        },
      { id: `sgeneral_adminroles:${uid}`, label: 'Admin Roles'      },
      { id: `sgeneral_logch:${uid}`,      label: 'Log Channel'      },
      { id: `sgeneral_modch:${uid}`,      label: 'Mod Channel'      },
      { id: `sgeneral_casech:${uid}`,     label: 'Case Channel'     },
      { id: `sgeneral_updatesch:${uid}`,  label: 'Updates Channel'  },
      { id: `sgeneral_save:${uid}`,       label: 'Save',             style: ButtonStyle.Success },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}

module.exports = [
  setup_hub_welcome,
  setup_hub_moderation,
  setup_hub_logging,
  setup_hub_tickets,
  setup_hub_leveling,
  setup_hub_roles,
  setup_hub_general,
]
