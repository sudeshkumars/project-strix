'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ButtonStyle } = require('discord.js')
const { buildSetupEmbed, buildRows } = require('../../../shared/setupBuilder')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Open the Stryx configuration panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute (client, interaction) {
    const { MessageFlags } = require('discord.js')
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const guild  = interaction.guild
    const config = interaction.guildConfig
    const uid    = interaction.user.id

    const embed = buildSetupEmbed(guild, {
      title:       'Stryx Configuration',
      description: 'Select a module below to configure it.\nAll changes are saved when you click **Save** inside each panel.',
      fields: [
        {
          name:   'Setup Status',
          value:  config?.setup_complete ? 'Initial setup complete' : 'Not yet configured — run through each module below',
          inline: false
        }
      ]
    })

    const rows = buildRows([
      { id: `setup_hub_general:${uid}`,     label: 'General',    style: ButtonStyle.Primary   },
      { id: `setup_hub_welcome:${uid}`,     label: 'Welcome',    style: ButtonStyle.Primary   },
      { id: `setup_hub_moderation:${uid}`,  label: 'Moderation', style: ButtonStyle.Primary   },
      { id: `setup_hub_automod:${uid}`,     label: 'AutoMod',    style: ButtonStyle.Primary   },
      { id: `setup_hub_logging:${uid}`,     label: 'Logging',    style: ButtonStyle.Primary   },
      { id: `setup_hub_tickets:${uid}`,     label: 'Tickets',    style: ButtonStyle.Primary   },
      { id: `setup_hub_leveling:${uid}`,    label: 'Leveling',   style: ButtonStyle.Primary   },
      { id: `setup_hub_roles:${uid}`,       label: 'Roles',      style: ButtonStyle.Primary   },
      { id: `setup_hub_community:${uid}`,   label: 'Community',  style: ButtonStyle.Primary   },
      { id: `setup_hub_scheduler:${uid}`,   label: 'Scheduler',  style: ButtonStyle.Primary   },
      { id: `setup_hub_reset:${uid}`,       label: 'Reset All',  style: ButtonStyle.Danger    },
    ])

    await interaction.editReply({ embeds: [embed], components: rows })
  }
}
