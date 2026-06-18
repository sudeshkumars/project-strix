'use strict'

const { SlashCommandBuilder, ChannelType } = require('discord.js')
const db           = require('../../../shared/db')
const { info }     = require('../../../shared/embed')
const { fullTime } = require('../../../shared/utils')

const VERIFICATION = ['None', 'Low', 'Medium', 'High', 'Very High']

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('View server information'),

  async execute (client, interaction) {
    await interaction.deferReply()

    const guild   = interaction.guild
    const guildId = guild.id

    await guild.fetch()

    const members  = guild.members.cache
    const bots     = members.filter(m => m.user.bot).size
    const humans   = guild.memberCount - bots
    const channels = guild.channels.cache
    const text     = channels.filter(c => c.type === ChannelType.GuildText).size
    const voice    = channels.filter(c => c.isVoiceBased()).size
    const cats     = channels.filter(c => c.type === ChannelType.GuildCategory).size
    const roles    = guild.roles.cache.size - 1  // exclude @everyone
    const emojis   = guild.emojis.cache.size
    const boosts   = guild.premiumSubscriptionCount ?? 0
    const tier     = guild.premiumTier

    const stats    = db.getActivityStats(guildId, 7)
    const totalMsg = stats.reduce((a, b) => a + (b.messages ?? 0), 0)
    const totalJoin = stats.reduce((a, b) => a + (b.joins ?? 0), 0)

    const embed = info(`🏠 ${guild.name}`, null)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'ID',           value: guild.id,                              inline: true  },
        { name: 'Owner',        value: `<@${guild.ownerId}>`,                 inline: true  },
        { name: 'Created',      value: fullTime(Math.floor(guild.createdTimestamp / 1000)), inline: true },
        { name: 'Members',      value: `👥 ${humans} humans | 🤖 ${bots} bots`, inline: true },
        { name: 'Channels',     value: `💬 ${text} text | 🔊 ${voice} voice | 📁 ${cats} cats`, inline: true },
        { name: 'Roles',        value: String(roles),                         inline: true  },
        { name: 'Emojis',       value: String(emojis),                        inline: true  },
        { name: 'Boosts',       value: `${boosts} (Tier ${tier})`,            inline: true  },
        { name: 'Verification', value: VERIFICATION[guild.verificationLevel] ?? 'Unknown', inline: true },
        { name: '7d Activity',  value: `📨 ${totalMsg} msgs | 📥 ${totalJoin} joins`, inline: false }
      )

    if (guild.description) embed.setDescription(guild.description)
    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }))

    const features = guild.features.slice(0, 6).map(f => `\`${f}\``).join(', ')
    if (features) embed.addFields({ name: 'Features', value: features, inline: false })

    await interaction.editReply({ embeds: [embed] })
  }
}
