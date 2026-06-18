'use strict'

const db           = require('../../shared/db')
const { safeSend } = require('../../shared/utils')
const { EmbedBuilder } = require('discord.js')
const { COLORS }   = require('../../shared/embed')

// Called from messageCreate after XP — lightweight check
async function checkHighlights (client, message) {
  if (!message.guild || message.author.bot) return
  if (!message.content) return

  const guildId = message.guild.id
  const content = message.content.toLowerCase()

  const highlights = db.getHighlights(guildId)
  if (!highlights.length) return

  // Group by user
  const byUser = new Map()
  for (const h of highlights) {
    if (h.user_id === message.author.id) continue  // don't notify sender
    if (!content.includes(h.word)) continue

    if (!byUser.has(h.user_id)) byUser.set(h.user_id, [])
    byUser.get(h.user_id).push(h.word)
  }

  for (const [userId, words] of byUser) {
    // Check user is in guild and not in the channel
    const member = message.guild.members.cache.get(userId)
    if (!member) continue

    // Don't notify if user can't see the channel
    if (!message.channel.permissionsFor(member)?.has('ViewChannel')) continue

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🔔 Highlight triggered')
      .setDescription(`Your word${words.length > 1 ? 's' : ''} **${words.map(w => `\`${w}\``).join(', ')}** ${words.length > 1 ? 'were' : 'was'} mentioned in ${message.channel}`)
      .addFields(
        { name: 'Server',  value: message.guild.name,  inline: true },
        { name: 'Channel', value: `#${message.channel.name}`, inline: true },
        { name: 'Message', value: message.content.slice(0, 200), inline: false }
      )
      .setFooter({ text: `By ${message.author.tag}` })
      .setTimestamp()

    await safeSend(member.user, { embeds: [embed] })
  }
}

module.exports = { checkHighlights }
