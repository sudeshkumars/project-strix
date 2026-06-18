'use strict'

const {
  EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js')
const { updateConfig } = require('../../../shared/cache')
const { success, info } = require('../../../shared/embed')
const db = require('../../../shared/db')

// One file handles all setup_* button IDs
const HANDLED = ['setup_basic', 'setup_channels', 'setup_leveling', 'setup_tickets', 'setup_done', 'setup_reset_cancel']

function makeNav (active) {
  return new ActionRowBuilder().addComponents(
    btn('setup_basic',    '⚙️ Basic',    active === 'basic'),
    btn('setup_channels', '📢 Channels', active === 'channels'),
    btn('setup_leveling', '⭐ Leveling', active === 'leveling'),
    btn('setup_tickets',  '🎫 Tickets',  active === 'tickets'),
    btn('setup_done',     '✅ Done',     false, ButtonStyle.Success)
  )
}

function btn (id, label, active, style) {
  return new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(active ? ButtonStyle.Primary : (style ?? ButtonStyle.Secondary))
    .setDisabled(active)
}

// ── Export one handler per button ID ─────────────────────────────────────────

module.exports = HANDLED.map(id => ({
  id,
  async execute (client, interaction, config) {
    // reset_cancel
    if (id === 'setup_reset_cancel') {
      return interaction.update({ embeds: [info('Reset Cancelled', 'No changes made.')], components: [] })
    }

    // done
    if (id === 'setup_done') {
      updateConfig(client, interaction.guild.id, { setup_complete: 1 }, { setup_complete: 1 })
      return interaction.update({
        embeds: [success('Setup Complete', 'Stryx is configured! Use `/config view` to review settings at any time.')],
        components: []
      })
    }

    const guild   = interaction.guild
    const guildId = guild.id
    const cfg     = client.guildCache.get(guildId) ?? {}

    const modRoles   = safeArr(cfg.mod_roles)
    const adminRoles = safeArr(cfg.admin_roles)

    // ── basic ─────────────────────────────────────────────────────────────────
    if (id === 'setup_basic') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Basic Settings')
        .addFields(
          { name: 'Prefix',      value: `\`${cfg.prefix ?? '!'}\``,                                    inline: true },
          { name: 'Mod Roles',   value: modRoles.length   ? modRoles.map(r => `<@&${r}>`).join(', ')   : 'Not set', inline: false },
          { name: 'Admin Roles', value: adminRoles.length ? adminRoles.map(r => `<@&${r}>`).join(', ') : 'Not set', inline: false }
        )
        .setFooter({ text: 'Use /config prefix | /config modrole | /config adminrole to edit' })

      return interaction.update({ embeds: [embed], components: [makeNav('basic')] })
    }

    // ── channels ──────────────────────────────────────────────────────────────
    if (id === 'setup_channels') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📢 Channel Settings')
        .addFields(
          { name: 'Log Channel',     value: cfg.log_channel     ? `<#${cfg.log_channel}>`     : '❌ Not set', inline: true },
          { name: 'Mod Channel',     value: cfg.mod_channel     ? `<#${cfg.mod_channel}>`     : '❌ Not set', inline: true },
          { name: 'Case Channel',    value: cfg.case_channel    ? `<#${cfg.case_channel}>`    : '❌ Not set', inline: true },
          { name: 'Welcome',         value: cfg.welcome_channel ? `<#${cfg.welcome_channel}>` : '❌ Not set', inline: true },
          { name: 'Goodbye',         value: cfg.goodbye_channel ? `<#${cfg.goodbye_channel}>` : '❌ Not set', inline: true },
          { name: 'Suggestions',     value: cfg.suggestions_channel ? `<#${cfg.suggestions_channel}>` : '❌ Not set', inline: true },
          { name: 'Starboard',       value: cfg.starboard_channel   ? `<#${cfg.starboard_channel}>`   : '❌ Not set', inline: true },
          { name: 'Updates Channel', value: cfg.updates_channel_id  ? `<#${cfg.updates_channel_id}>`  : '❌ Not set', inline: true }
        )
        .setFooter({ text: 'Use /config logchannel | modchannel | casechannel | etc to edit' })

      return interaction.update({ embeds: [embed], components: [makeNav('channels')] })
    }

    // ── leveling ──────────────────────────────────────────────────────────────
    if (id === 'setup_leveling') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⭐ Leveling Settings')
        .addFields(
          { name: 'XP Range',       value: `${cfg.xp_min ?? 15} – ${cfg.xp_max ?? 25} per message`, inline: true },
          { name: 'XP Cooldown',    value: `${cfg.xp_cooldown ?? 60}s`,                              inline: true },
          { name: 'Level-up Msg',   value: `\`${cfg.levelup_message ?? 'GG {user}, you reached level {level}!'}\``, inline: false },
          { name: 'Level-up Ch',    value: cfg.levelup_channel ? `<#${cfg.levelup_channel}>` : 'Same channel', inline: true }
        )
        .setFooter({ text: 'Use /config xp | /levelroles | /xpmulti | /xpblacklist to edit' })

      return interaction.update({ embeds: [embed], components: [makeNav('leveling')] })
    }

    // ── tickets ───────────────────────────────────────────────────────────────
    if (id === 'setup_tickets') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎫 Ticket Settings')
        .addFields(
          { name: 'Category',      value: cfg.ticket_category     ? `<#${cfg.ticket_category}>`     : '❌ Not set', inline: true },
          { name: 'Support Role',  value: cfg.ticket_support_role ? `<@&${cfg.ticket_support_role}>` : '❌ Not set', inline: true },
          { name: 'Auto-close',    value: cfg.ticket_auto_close ? `${cfg.ticket_auto_close}h idle` : 'Disabled', inline: true }
        )
        .setFooter({ text: 'Use /config tickets | /ticketpanel to edit' })

      return interaction.update({ embeds: [embed], components: [makeNav('tickets')] })
    }
  }
}))

function safeArr (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
