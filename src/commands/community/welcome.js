'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ButtonStyle, MessageFlags } = require('discord.js')
const {
  buildSetupEmbed, buildRows, setSession,
  displayChannel, displayBool, display
} = require('../../../shared/setupBuilder')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure the welcome and goodbye system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute (client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const guild   = interaction.guild
    const config  = interaction.guildConfig
    const uid     = interaction.user.id
    const guildId = guild.id

    // Seed session with current config values
    setSession(uid, guildId, 'welcome', {
      pending: {
        welcome_channel:     config?.welcome_channel     ?? null,
        goodbye_channel:     config?.goodbye_channel     ?? null,
        welcome_style:       config?.welcome_style       ?? 'embed',
        welcome_message:     config?.welcome_message     ?? 'Welcome {user} to {server}!',
        goodbye_message:     config?.goodbye_message     ?? '{username} has left {server}.',
        welcome_color:       config?.welcome_color       ?? '#5865F2',
        welcome_bg_url:      config?.welcome_bg_url      ?? null,
        welcome_bg_source:   config?.welcome_bg_source   ?? 'default',
        welcome_show_avatar: config?.welcome_show_avatar ?? 1,
        welcome_avatar_src:  config?.welcome_avatar_src  ?? 'user',
        welcome_dm:          config?.welcome_dm          ?? 0,
        welcome_dm_message:  config?.welcome_dm_message  ?? null,
        welcome_autorole:    config?.welcome_autorole     ?? []
      }
    })

    await interaction.editReply(buildWelcomePanel(guild, uid, config))
  }
}

function buildWelcomePanel (guild, uid, config) {
  const p = config ?? {}

  const autoroles = Array.isArray(p.welcome_autorole)
    ? p.welcome_autorole.map(r => `<@&${r}>`).join(', ') || 'None'
    : 'None'

  const embed = buildSetupEmbed(guild, {
    title:       'Welcome Setup',
    description: 'Configure welcome and goodbye messages for this server.\nClick a button to change a setting, then click **Save** when done.',
    fields: [
      { name: 'Welcome Channel',  value: displayChannel(p.welcome_channel),                            inline: true  },
      { name: 'Goodbye Channel',  value: displayChannel(p.goodbye_channel),                            inline: true  },
      { name: 'Style',            value: p.welcome_style ?? 'embed',                                   inline: true  },
      { name: 'Background',       value: p.welcome_bg_source ?? 'default',                             inline: true  },
      { name: 'Avatar',           value: displayBool(p.welcome_show_avatar ?? 1),                      inline: true  },
      { name: 'Avatar Source',    value: p.welcome_avatar_src ?? 'user',                               inline: true  },
      { name: 'DM on Join',       value: displayBool(p.welcome_dm),                                    inline: true  },
      { name: 'Auto Role',        value: autoroles,                                                     inline: true  },
      { name: 'Color',            value: display(p.welcome_color, ''),                                 inline: true  },
      { name: 'Welcome Message',  value: `\`${p.welcome_message ?? 'Welcome {user} to {server}!'}\``, inline: false },
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

module.exports.buildWelcomePanel = buildWelcomePanel
