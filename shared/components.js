'use strict'

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js')

// ─── Palette (mirrors shared/embed.js) ───────────────────────────────────────
const COLORS = {
  success: 0x57F287,
  error:   0xED4245,
  warn:    0xFEE75C,
  info:    0x5865F2,
  mod:     0xEB459E,
  level:   0xF4A460,
  log:     0x99AAB5
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve an accent value to a numeric color.
 * Accepts a hex int (e.g. 0x57F287) or a named key from COLORS (e.g. 'success').
 * @param {number|string} accent
 * @returns {number}
 */
function resolveColor (accent) {
  if (typeof accent === 'string') {
    return COLORS[accent] ?? COLORS.info
  }
  return accent
}

/**
 * Cap a list of items to a maximum length.
 * If items exceed max, the returned array is sliced and a trailing
 * "...and X more" line is appended.
 *
 * @param {any[]} items - The full list
 * @param {number} [max=15] - Maximum items to show
 * @param {function} [formatter] - Optional fn(item) => string formatter
 * @returns {string[]}
 */
function capList (items, max = 15, formatter) {
  if (!items || items.length === 0) return []
  const fn = formatter || (i => String(i))
  if (items.length <= max) return items.map(fn)
  const shown = items.slice(0, max).map(fn)
  shown.push(`...and ${items.length - max} more`)
  return shown
}

// ─── Card Builder ─────────────────────────────────────────────────────────────

/**
 * Build a V2 Components card (ContainerBuilder) with structured content.
 *
 * @param {object} opts
 * @param {number|string} opts.accent - Hex color int or COLORS key for the left bar
 * @param {string} opts.title - Bold title text
 * @param {string[]} [opts.lines] - Body lines (e.g. "**Label** - value")
 * @param {Array<{heading: string, content: string}>} [opts.blocks] - Additional sections
 * @param {string} [opts.subtext] - Small footer text (rendered as -# subtext)
 * @param {Array<{id?: string, label: string, style?: number, emoji?: string, disabled?: boolean, url?: string}>} [opts.buttons] - Button configs
 * @param {string} [opts.image] - Image URL for MediaGallery
 * @param {string} [opts.thumbnail] - Thumbnail URL (small image)
 * @returns {ContainerBuilder}
 */
function buildCard (opts = {}) {
  const {
    accent = 'info',
    title,
    lines = [],
    blocks = [],
    subtext,
    buttons,
    image,
    thumbnail
  } = opts

  const container = new ContainerBuilder().setAccentColor(resolveColor(accent))

  // ── Title
  if (title) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${title}**`)
    )
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
  }

  // ── Thumbnail (rendered as a small media gallery before body)
  if (thumbnail) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(thumbnail)
      )
    )
  }

  // ── Body lines
  if (lines.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n'))
    )
  }

  // ── Additional blocks (each preceded by a separator)
  for (const block of blocks) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    let blockText = ''
    if (block.heading) blockText += `**${block.heading}**\n`
    if (block.content) blockText += block.content
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(blockText.trim())
    )
  }

  // ── Image (MediaGallery)
  if (image) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(image)
      )
    )
  }

  // ── Buttons
  if (buttons && buttons.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    const row = new ActionRowBuilder()
    for (const btn of buttons) {
      const b = new ButtonBuilder().setLabel(btn.label)
      if (btn.url) {
        b.setStyle(ButtonStyle.Link).setURL(btn.url)
      } else {
        b.setStyle(btn.style ?? ButtonStyle.Primary)
        if (btn.id) b.setCustomId(btn.id)
      }
      if (btn.emoji) b.setEmoji(btn.emoji)
      if (btn.disabled) b.setDisabled(true)
      row.addComponents(b)
    }
    container.addActionRowComponents(row)
  }

  // ── Subtext footer
  const footerText = subtext || process.env.FOOTER_TEXT || 'Stryx'
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  )
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${footerText}`)
  )

  return container
}

// ─── Payload Builder ──────────────────────────────────────────────────────────

/**
 * Build a full message payload with V2 Components flag.
 * Wraps buildCard and returns an object ready to pass to channel.send() or
 * interaction.reply().
 *
 * @param {object} cardOpts - Same options as buildCard
 * @returns {{ components: ContainerBuilder[], flags: number, allowedMentions: object }}
 */
function buildCardPayload (cardOpts) {
  const card = buildCard(cardOpts)
  return {
    components: [card],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: ['users', 'roles'] }
  }
}

// ─── Status Shorthand Helpers ─────────────────────────────────────────────────

/**
 * @param {string} title
 * @param {string[]} lines
 * @param {object} [opts] - Additional buildCardPayload options (blocks, subtext, buttons, etc.)
 */
function successCard (title, lines, opts = {}) {
  return buildCardPayload({ accent: 'success', title, lines, ...opts })
}

function errorCard (title, lines, opts = {}) {
  return buildCardPayload({ accent: 'error', title, lines, ...opts })
}

function warnCard (title, lines, opts = {}) {
  return buildCardPayload({ accent: 'warn', title, lines, ...opts })
}

function infoCard (title, lines, opts = {}) {
  return buildCardPayload({ accent: 'info', title, lines, ...opts })
}

function modCard (title, lines, opts = {}) {
  return buildCardPayload({ accent: 'mod', title, lines, ...opts })
}

module.exports = {
  COLORS,
  buildCard,
  buildCardPayload,
  successCard,
  errorCard,
  warnCard,
  infoCard,
  modCard,
  capList
}
