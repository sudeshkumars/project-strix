'use strict'

const { EmbedBuilder, AttachmentBuilder } = require('discord.js')
const { getConfig } = require('../../shared/cache')
const { safeSend }  = require('../../shared/utils')

// Track starred messages: Map<guildId:messageId, starboardMessageId>
const starredMessages = new Map()

module.exports = {
  name: 'messageReactionAdd',
  async execute (client, reaction, user) {
    if (user.bot) return

    // Fetch partial reaction/message
    if (reaction.partial) {
      try { await reaction.fetch() } catch { return }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch() } catch { return }
    }

    const message = reaction.message
    if (!message.guild) return
    if (message.author?.bot) return

    const config = getConfig(client, message.guild.id)
    if (!config?.starboard_channel) return

    const starEmoji  = config.star_emoji ?? '⭐'
    const threshold  = config.star_threshold ?? 3

    if (reaction.emoji.name !== starEmoji && reaction.emoji.toString() !== starEmoji) return
    if (message.channel.id === config.starboard_channel) return

    const starCount = reaction.count
    if (starCount < threshold) return

    const key     = `${message.guild.id}:${message.id}`
    const sbCh    = message.guild.channels.cache.get(config.starboard_channel)
    if (!sbCh) return

    // Build starboard embed
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setAuthor({
        name:    message.author.tag,
        iconURL: message.author.displayAvatarURL({ size: 64 })
      })
      .setDescription(message.content?.slice(0, 2000) || null)
      .addFields(
        { name: 'Source', value: `[Jump to message](${message.url})`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`,         inline: true }
      )
      .setFooter({ text: `${starEmoji} ${starCount} • ${message.id}` })
      .setTimestamp(message.createdAt)

    // Attach image if present
    const img = message.attachments.find(a => a.contentType?.startsWith('image/'))
    if (img) embed.setImage(img.url)
    if (message.embeds[0]?.image) embed.setImage(message.embeds[0].image.url)
    if (message.embeds[0]?.thumbnail) embed.setThumbnail(message.embeds[0].thumbnail.url)

    const content = `${starEmoji} **${starCount}** <#${message.channel.id}>`

    if (starredMessages.has(key)) {
      // Update existing starboard message
      try {
        const sbMsg = await sbCh.messages.fetch(starredMessages.get(key))
        await sbMsg.edit({ content, embeds: [embed] })
      } catch {
        // Message deleted — re-post
        const sent = await safeSend(sbCh, { content, embeds: [embed] })
        if (sent) starredMessages.set(key, sent.id)
      }
    } else {
      const sent = await safeSend(sbCh, { content, embeds: [embed] })
      if (sent) starredMessages.set(key, sent.id)
    }
  }
}
