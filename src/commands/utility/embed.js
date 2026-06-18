'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder
} = require('discord.js')
const { success, error } = require('../../../shared/embed')
const { infoCard }       = require('../../../shared/components')
const db                 = require('../../../shared/db')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEX_RE = /^#?([0-9A-Fa-f]{6})$/

function parseColor (str) {
  if (!str) return null
  const m = str.match(HEX_RE)
  return m ? parseInt(m[1], 16) : null
}

function parseFields (str) {
  if (!str) return []
  try {
    const arr = JSON.parse(str)
    if (!Array.isArray(arr)) return null
    for (const f of arr) {
      if (typeof f.name !== 'string' || typeof f.value !== 'string') return null
    }
    return arr.slice(0, 25)
  } catch {
    return null
  }
}

function buildEmbed (opts) {
  const embed = new EmbedBuilder()
  const color = parseColor(opts.color)
  embed.setColor(color ?? 0x5865F2)
  if (opts.title)       embed.setTitle(opts.title)
  if (opts.description) embed.setDescription(opts.description)
  if (opts.footer)      embed.setFooter({ text: opts.footer })
  if (opts.image)       embed.setImage(opts.image)
  if (opts.thumbnail)   embed.setThumbnail(opts.thumbnail)
  if (opts.timestamp)   embed.setTimestamp()
  if (opts.author_name) {
    const author = { name: opts.author_name }
    if (opts.author_icon) author.iconURL = opts.author_icon
    embed.setAuthor(author)
  }
  if (opts.fields && opts.fields.length) {
    for (const f of opts.fields) {
      embed.addFields({ name: f.name, value: f.value, inline: !!f.inline })
    }
  }
  return embed
}

function getEmbedOpts (interaction) {
  return {
    title:       interaction.options.getString('title'),
    description: interaction.options.getString('description'),
    color:       interaction.options.getString('color'),
    footer:      interaction.options.getString('footer'),
    image:       interaction.options.getString('image'),
    thumbnail:   interaction.options.getString('thumbnail'),
    timestamp:   interaction.options.getBoolean('timestamp') ?? false,
    author_name: interaction.options.getString('author-name'),
    author_icon: interaction.options.getString('author-icon-url'),
    fields:      interaction.options.getString('fields')
  }
}

function validateOpts (opts) {
  if (opts.color && !parseColor(opts.color)) {
    return 'Invalid color. Use hex format like `#5865F2`.'
  }
  if (opts.fields && typeof opts.fields === 'string') {
    const parsed = parseFields(opts.fields)
    if (parsed === null) {
      return 'Invalid fields JSON. Use format: `[{"name":"x","value":"y","inline":true}]`'
    }
    opts.fields = parsed
  }
  if (!opts.fields) opts.fields = []
  return null
}

// ─── Embed option adder (shared across subcommands) ───────────────────────────

function addEmbedOptions (cmd) {
  return cmd
    .addStringOption(o => o.setName('title').setDescription('Embed title').setMaxLength(256))
    .addStringOption(o => o.setName('description').setDescription('Embed description').setMaxLength(4096))
    .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #5865F2'))
    .addStringOption(o => o.setName('footer').setDescription('Footer text').setMaxLength(2048))
    .addStringOption(o => o.setName('image').setDescription('Image URL'))
    .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail URL'))
    .addBooleanOption(o => o.setName('timestamp').setDescription('Add timestamp'))
    .addStringOption(o => o.setName('author-name').setDescription('Author name').setMaxLength(256))
    .addStringOption(o => o.setName('author-icon-url').setDescription('Author icon URL'))
    .addStringOption(o => o.setName('fields').setDescription('Fields JSON: [{"name":"x","value":"y","inline":true}]').setMaxLength(4000))
}

// ─── Command Definition ───────────────────────────────────────────────────────

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Powerful embed builder - send, edit, preview, templates')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    // /embed send
    .addSubcommand(s => {
      s.setName('send').setDescription('Build and send an embed to a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to send in').setRequired(true))
      return addEmbedOptions(s)
    })
    // /embed edit
    .addSubcommand(s => {
      s.setName('edit').setDescription('Edit an existing message embed')
        .addStringOption(o => o.setName('message-id').setDescription('Message ID to edit').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel the message is in').setRequired(true))
      return addEmbedOptions(s)
    })
    // /embed preview
    .addSubcommand(s => {
      s.setName('preview').setDescription('Preview an embed (ephemeral)')
      return addEmbedOptions(s)
    })
    // /embed json
    .addSubcommand(s => s
      .setName('json')
      .setDescription('Send an embed from raw JSON')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send in').setRequired(true))
      .addStringOption(o => o.setName('json').setDescription('Full embed JSON object').setRequired(true).setMaxLength(4000)))
    // /embed template-save
    .addSubcommand(s => {
      s.setName('template-save').setDescription('Save embed config as a reusable template')
        .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setMaxLength(32))
      return addEmbedOptions(s)
    })
    // /embed template-load
    .addSubcommand(s => s
      .setName('template-load')
      .setDescription('Load and send a saved template')
      .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send in').setRequired(true)))
    // /embed template-list
    .addSubcommand(s => s
      .setName('template-list')
      .setDescription('List all saved templates for this guild'))
    // /embed template-delete
    .addSubcommand(s => s
      .setName('template-delete')
      .setDescription('Delete a template')
      .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true).setAutocomplete(true))),

  async autocomplete (client, interaction) {
    const focused   = interaction.options.getFocused().toLowerCase()
    const templates = db.getEmbedTemplates(interaction.guild.id)
    const choices   = templates
      .filter(t => t.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(t => ({ name: t.name, value: t.name }))
    await interaction.respond(choices)
  },

  async execute (client, interaction) {
    const sub = interaction.options.getSubcommand()

    // ── /embed send ──────────────────────────────────────────────────────────
    if (sub === 'send') {
      await interaction.deferReply({ ephemeral: true })
      const channel = interaction.options.getChannel('channel')
      const opts    = getEmbedOpts(interaction)

      if (!opts.title && !opts.description) {
        return interaction.editReply({ embeds: [error('Empty embed', 'Provide at least a title or description.')] })
      }
      const err = validateOpts(opts)
      if (err) return interaction.editReply({ embeds: [error('Validation Error', err)] })

      const embed = buildEmbed(opts)
      try {
        await channel.send({ embeds: [embed] })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }
      return interaction.editReply({ content: `\u2705 Embed sent to ${channel}.` })
    }

    // ── /embed edit ──────────────────────────────────────────────────────────
    if (sub === 'edit') {
      await interaction.deferReply({ ephemeral: true })
      const messageId = interaction.options.getString('message-id')
      const channel   = interaction.options.getChannel('channel')
      const opts      = getEmbedOpts(interaction)

      if (!opts.title && !opts.description) {
        return interaction.editReply({ embeds: [error('Empty embed', 'Provide at least a title or description.')] })
      }
      const err = validateOpts(opts)
      if (err) return interaction.editReply({ embeds: [error('Validation Error', err)] })

      let message
      try {
        message = await channel.messages.fetch(messageId)
      } catch {
        return interaction.editReply({ embeds: [error('Not Found', 'Could not find that message in the specified channel.')] })
      }

      if (message.author.id !== client.user.id) {
        return interaction.editReply({ embeds: [error('Cannot Edit', 'I can only edit messages sent by me.')] })
      }

      const embed = buildEmbed(opts)
      try {
        await message.edit({ embeds: [embed] })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }
      return interaction.editReply({ content: `\u2705 Embed updated in ${channel}.` })
    }

    // ── /embed preview ───────────────────────────────────────────────────────
    if (sub === 'preview') {
      await interaction.deferReply({ ephemeral: true })
      const opts = getEmbedOpts(interaction)

      if (!opts.title && !opts.description) {
        return interaction.editReply({ embeds: [error('Empty embed', 'Provide at least a title or description.')] })
      }
      const err = validateOpts(opts)
      if (err) return interaction.editReply({ embeds: [error('Validation Error', err)] })

      const lines = []
      if (opts.title)       lines.push(`**Title:** ${opts.title}`)
      if (opts.description) lines.push(`**Description:** ${opts.description.length > 100 ? opts.description.slice(0, 100) + '...' : opts.description}`)
      if (opts.color)       lines.push(`**Color:** ${opts.color}`)
      if (opts.footer)      lines.push(`**Footer:** ${opts.footer}`)
      if (opts.image)       lines.push(`**Image:** set`)
      if (opts.thumbnail)   lines.push(`**Thumbnail:** set`)
      if (opts.author_name) lines.push(`**Author:** ${opts.author_name}`)
      if (opts.fields.length) lines.push(`**Fields:** ${opts.fields.length}`)
      if (opts.timestamp)   lines.push(`**Timestamp:** yes`)

      const preview = infoCard('Embed Preview', lines, {
        subtext: 'This is a V2 card preview of your embed configuration'
      })

      // Also send the actual embed as a classic embed preview
      const embed = buildEmbed(opts)
      return interaction.editReply({ ...preview, embeds: [embed] })
    }

    // ── /embed json ──────────────────────────────────────────────────────────
    if (sub === 'json') {
      await interaction.deferReply({ ephemeral: true })
      const channel = interaction.options.getChannel('channel')
      const jsonStr = interaction.options.getString('json')

      let parsed
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        return interaction.editReply({ embeds: [error('Invalid JSON', 'Could not parse the provided JSON string.')] })
      }

      let embed
      try {
        embed = new EmbedBuilder(parsed)
      } catch (e) {
        return interaction.editReply({ embeds: [error('Invalid Embed', e.message)] })
      }

      try {
        await channel.send({ embeds: [embed] })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }
      return interaction.editReply({ content: `\u2705 JSON embed sent to ${channel}.` })
    }

    // ── /embed template-save ─────────────────────────────────────────────────
    if (sub === 'template-save') {
      await interaction.deferReply({ ephemeral: true })
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-')
      const opts = getEmbedOpts(interaction)

      if (name.length > 32) {
        return interaction.editReply({ embeds: [error('Name Too Long', 'Template name must be 32 characters or less.')] })
      }
      if (!opts.title && !opts.description) {
        return interaction.editReply({ embeds: [error('Empty Template', 'Provide at least a title or description.')] })
      }
      const err = validateOpts(opts)
      if (err) return interaction.editReply({ embeds: [error('Validation Error', err)] })

      // Check max templates per guild
      const existing = db.getEmbedTemplates(interaction.guild.id)
      if (existing.length >= 25) {
        return interaction.editReply({ embeds: [error('Limit Reached', 'Maximum of 25 templates per guild. Delete some before saving new ones.')] })
      }

      // Check if name already exists
      const dupe = db.getEmbedTemplate(interaction.guild.id, name)
      if (dupe) {
        return interaction.editReply({ embeds: [error('Duplicate Name', `A template named \`${name}\` already exists. Delete it first or use a different name.`)] })
      }

      try {
        db.createEmbedTemplate(interaction.guild.id, name, {
          title:       opts.title,
          description: opts.description,
          color:       opts.color,
          footer:      opts.footer,
          image:       opts.image,
          thumbnail:   opts.thumbnail,
          author_name: opts.author_name,
          author_icon: opts.author_icon,
          fields:      opts.fields
        }, interaction.user.id)
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }

      return interaction.editReply({ embeds: [success('Template Saved', `Template \`${name}\` saved successfully.`)] })
    }

    // ── /embed template-load ─────────────────────────────────────────────────
    if (sub === 'template-load') {
      await interaction.deferReply({ ephemeral: true })
      const name    = interaction.options.getString('name').toLowerCase()
      const channel = interaction.options.getChannel('channel')

      const template = db.getEmbedTemplate(interaction.guild.id, name)
      if (!template) {
        return interaction.editReply({ embeds: [error('Not Found', `No template named \`${name}\` found.`)] })
      }

      let fields = []
      try { fields = JSON.parse(template.fields || '[]') } catch { /* empty */ }

      const embed = buildEmbed({
        title:       template.title,
        description: template.description,
        color:       template.color,
        footer:      template.footer,
        image:       template.image,
        thumbnail:   template.thumbnail,
        author_name: template.author_name,
        author_icon: template.author_icon,
        fields
      })

      try {
        await channel.send({ embeds: [embed] })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }
      return interaction.editReply({ content: `\u2705 Template \`${name}\` sent to ${channel}.` })
    }

    // ── /embed template-list ─────────────────────────────────────────────────
    if (sub === 'template-list') {
      await interaction.deferReply({ ephemeral: true })
      const templates = db.getEmbedTemplates(interaction.guild.id)

      if (!templates.length) {
        return interaction.editReply({ embeds: [error('No Templates', 'No embed templates saved for this guild yet.')] })
      }

      const lines = templates.map((t, i) => {
        const title = t.title || t.description?.slice(0, 30) || 'No title'
        return `**${i + 1}.** \`${t.name}\` - ${title}`
      })

      const payload = infoCard('Embed Templates', lines, {
        subtext: `${templates.length}/25 templates used`
      })
      return interaction.editReply(payload)
    }

    // ── /embed template-delete ───────────────────────────────────────────────
    if (sub === 'template-delete') {
      await interaction.deferReply({ ephemeral: true })
      const name = interaction.options.getString('name').toLowerCase()

      const template = db.getEmbedTemplate(interaction.guild.id, name)
      if (!template) {
        return interaction.editReply({ embeds: [error('Not Found', `No template named \`${name}\` found.`)] })
      }

      db.deleteEmbedTemplate(interaction.guild.id, name)
      return interaction.editReply({ embeds: [success('Template Deleted', `Template \`${name}\` has been deleted.`)] })
    }
  }
}
