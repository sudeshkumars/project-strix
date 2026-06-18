'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder
} = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { safeSend }             = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('Manage self-assignable role panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a new role panel')
      .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption(o => o.setName('style').setDescription('Button or dropdown').setRequired(false)
        .addChoices({ name: 'Buttons', value: 'button' }, { name: 'Dropdown', value: 'select' }))
      .addBooleanOption(o => o.setName('exclusive').setDescription('Only one role at a time').setRequired(false)))
    .addSubcommand(s => s
      .setName('addrole')
      .setDescription('Add a role to a panel')
      .addIntegerOption(o => o.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Button/option label').setRequired(false))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Dropdown description').setRequired(false)))
    .addSubcommand(s => s
      .setName('removerole')
      .setDescription('Remove a role from a panel')
      .addIntegerOption(o => o.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s
      .setName('post')
      .setDescription('Post a panel to a channel')
      .addIntegerOption(o => o.setName('panel_id').setDescription('Panel ID').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(false)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all role panels'))
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete a panel')
      .addIntegerOption(o => o.setName('panel_id').setDescription('Panel ID').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    // ── create ────────────────────────────────────────────────────────────────
    if (sub === 'create') {
      const title     = interaction.options.getString('title')
      const style     = interaction.options.getString('style') ?? 'button'
      const exclusive = interaction.options.getBoolean('exclusive') ?? false

      const panelId = db.createRolePanel(guildId, title, style)
      db.updateRolePanel(panelId, guildId, { exclusive: exclusive ? 1 : 0 })

      return interaction.editReply({
        embeds: [success('Panel Created', `Panel **#${panelId}** created.\nUse \`/rolepanel addrole\` to add roles, then \`/rolepanel post\` to deploy it.`)]
      })
    }

    // ── addrole ───────────────────────────────────────────────────────────────
    if (sub === 'addrole') {
      const panelId = interaction.options.getInteger('panel_id')
      const role    = interaction.options.getRole('role')
      const label   = interaction.options.getString('label') ?? role.name
      const emoji   = interaction.options.getString('emoji') ?? null
      const desc    = interaction.options.getString('description') ?? null

      const panel = db.getRolePanel(panelId, guildId)
      if (!panel) return interaction.editReply({ embeds: [error('Not found', `Panel #${panelId} not found.`)] })

      if (role.managed) return interaction.editReply({ embeds: [error('Invalid', 'Cannot use bot-managed roles.')] })

      const roles = safeParseArray(panel.roles)
      if (roles.find(r => r.id === role.id)) {
        return interaction.editReply({ embeds: [error('Already added', `${role} is already in this panel.`)] })
      }

      roles.push({ id: role.id, label, emoji, description: desc })
      db.updateRolePanel(panelId, guildId, { roles: JSON.stringify(roles) })

      return interaction.editReply({ embeds: [success('Role Added', `${role} added to panel **#${panelId}**.`)] })
    }

    // ── removerole ────────────────────────────────────────────────────────────
    if (sub === 'removerole') {
      const panelId = interaction.options.getInteger('panel_id')
      const role    = interaction.options.getRole('role')
      const panel   = db.getRolePanel(panelId, guildId)
      if (!panel) return interaction.editReply({ embeds: [error('Not found', `Panel #${panelId} not found.`)] })

      const roles = safeParseArray(panel.roles).filter(r => r.id !== role.id)
      db.updateRolePanel(panelId, guildId, { roles: JSON.stringify(roles) })
      return interaction.editReply({ embeds: [success('Role Removed', `${role} removed from panel **#${panelId}**.`)] })
    }

    // ── post ──────────────────────────────────────────────────────────────────
    if (sub === 'post') {
      const panelId = interaction.options.getInteger('panel_id')
      const channel = interaction.options.getChannel('channel')
      const desc    = interaction.options.getString('description') ?? 'Select a role below.'
      const panel   = db.getRolePanel(panelId, guildId)
      if (!panel) return interaction.editReply({ embeds: [error('Not found', `Panel #${panelId} not found.`)] })

      const roles = safeParseArray(panel.roles)
      if (!roles.length) return interaction.editReply({ embeds: [error('No roles', 'Add roles to this panel first.')] })

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(panel.title)
        .setDescription(desc)
        .setFooter({ text: `Panel #${panelId}${panel.exclusive ? ' • Exclusive' : ''}` })

      let components
      if (panel.style === 'select') {
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`rolepanel_select:${panelId}`)
          .setPlaceholder('Select a role...')
          .setMinValues(0)
          .setMaxValues(panel.exclusive ? 1 : Math.min(roles.length, 25))
          .addOptions(roles.map(r => ({
            label:       r.label,
            value:       r.id,
            emoji:       r.emoji ?? undefined,
            description: r.description ?? undefined
          })))
        components = [new ActionRowBuilder().addComponents(menu)]
      } else {
        // Buttons — max 25, split into rows of 5
        const buttons = roles.slice(0, 25).map(r =>
          new ButtonBuilder()
            .setCustomId(`rolepanel_btn:${panelId}:${r.id}`)
            .setLabel(r.label)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(r.emoji ?? undefined)
        )
        components = []
        for (let i = 0; i < buttons.length; i += 5) {
          components.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)))
        }
      }

      let msg
      try { msg = await channel.send({ embeds: [embed], components }) }
      catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }

      db.updateRolePanel(panelId, guildId, {
        channel_id: channel.id,
        message_id: msg.id
      })

      return interaction.editReply({ embeds: [success('Panel Posted', `Panel **#${panelId}** posted in ${channel}.`)] })
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const panels = db.getRolePanels(guildId)
      if (!panels.length) return interaction.editReply({ content: 'No role panels configured.' })

      const embed = info('🎭 Role Panels', null)
      for (const p of panels) {
        const roles = safeParseArray(p.roles)
        embed.addFields({
          name:  `#${p.panel_id} — ${p.title} (${p.style})`,
          value: `Roles: ${roles.length} | Exclusive: ${p.exclusive ? 'Yes' : 'No'}${p.channel_id ? ` | <#${p.channel_id}>` : ''}`,
          inline: false
        })
      }
      return interaction.editReply({ embeds: [embed] })
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const panelId = interaction.options.getInteger('panel_id')
      db.deleteRolePanel(panelId, guildId)
      return interaction.editReply({ embeds: [success('Deleted', `Panel **#${panelId}** deleted.`)] })
    }
  }
}

function safeParseArray (val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
