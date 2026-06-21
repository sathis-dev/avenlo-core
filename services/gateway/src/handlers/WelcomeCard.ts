// ====================================
// AVENLO CORE - WELCOME CARD RENDERER
// Dynamic onboarding card generated server-side
// ====================================

import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import type { GuildMember } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';
import { createLogger } from '@avenlo/shared';
import type { WelcomeConfigData } from '@avenlo/shared';

const logger = createLogger('welcome-card');

const CARD_WIDTH = 1100;
const CARD_HEIGHT = 360;
const AVATAR_SIZE = 240;
const AVATAR_X = 60;
const AVATAR_Y = (CARD_HEIGHT - AVATAR_SIZE) / 2;
const BORDER_RADIUS = 28;

let fontsRegistered = false;

function registerFontsOnce(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  // @napi-rs/canvas ships with a built-in fallback font, so we only
  // need to make sure GlobalFonts is loaded — explicit registration of
  // additional families is optional and skipped here for portability.
  void GlobalFonts;
}

function drawRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

interface RenderContext {
  member: GuildMember;
  config: WelcomeConfigData;
}

/**
 * Render the welcome card as a PNG buffer.
 *
 * Layout (left → right):
 *   - Dark gradient background with subtle vignette
 *   - Glowing neon border in the configured cyan
 *   - Circular avatar (clipped) with neon stroke
 *   - "WELCOME" eyebrow + username + tagline
 *   - Footer with server name and member count
 */
export async function renderWelcomeCard(
  rc: RenderContext
): Promise<Buffer> {
  registerFontsOnce();

  const { member, config } = rc;
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // ----- Background gradient -----
  const bgGradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGradient.addColorStop(0, '#05060B');
  bgGradient.addColorStop(0.5, '#0A0C18');
  bgGradient.addColorStop(1, '#04050A');
  ctx.fillStyle = bgGradient;
  drawRoundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, BORDER_RADIUS);
  ctx.fill();

  // ----- Subtle grid / scanlines for "technical" feel -----
  ctx.save();
  drawRoundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, BORDER_RADIUS);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < CARD_HEIGHT; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // ----- Glowing neon border -----
  ctx.save();
  ctx.shadowColor = config.neonBorderColor;
  ctx.shadowBlur = 28;
  ctx.strokeStyle = config.neonBorderColor;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 4, 4, CARD_WIDTH - 8, CARD_HEIGHT - 8, BORDER_RADIUS - 4);
  ctx.stroke();
  ctx.restore();

  // ----- Avatar (circular clip) -----
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarUrl);

    const cx = AVATAR_X + AVATAR_SIZE / 2;
    const cy = AVATAR_Y + AVATAR_SIZE / 2;

    // Outer neon halo
    ctx.save();
    ctx.shadowColor = config.neonBorderColor;
    ctx.shadowBlur = 35;
    ctx.strokeStyle = config.neonBorderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Clip + draw avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
    ctx.restore();
  } catch (err) {
    logger.warn('Failed to load avatar — falling back to placeholder', {
      userId: member.id,
      err: err instanceof Error ? err.message : String(err),
    });
    ctx.save();
    ctx.fillStyle = '#12131A';
    ctx.beginPath();
    ctx.arc(
      AVATAR_X + AVATAR_SIZE / 2,
      AVATAR_Y + AVATAR_SIZE / 2,
      AVATAR_SIZE / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // ----- Text block -----
  const textX = AVATAR_X + AVATAR_SIZE + 60;

  // Eyebrow: "WELCOME TO {GUILD}"
  ctx.fillStyle = config.neonBorderColor;
  ctx.font = 'bold 22px "Liberation Sans", sans-serif';
  ctx.textBaseline = 'top';
  const guildName = clampText(member.guild.name.toUpperCase(), 32);
  ctx.fillText(`WELCOME TO ${guildName}`, textX, 70);

  // Username (geometric, large)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 56px "Liberation Sans", sans-serif';
  const username = clampText(member.user.displayName, 18);
  ctx.fillText(username, textX, 105);

  // Underline accent (cyan → gold gradient)
  const underlineY = 180;
  const underlineGradient = ctx.createLinearGradient(textX, underlineY, textX + 380, underlineY);
  underlineGradient.addColorStop(0, config.neonBorderColor);
  underlineGradient.addColorStop(1, config.embedAccentColor);
  ctx.fillStyle = underlineGradient;
  ctx.fillRect(textX, underlineY, 380, 3);

  // Tagline
  ctx.fillStyle = '#A5ADBA';
  ctx.font = '22px "Liberation Sans", sans-serif';
  ctx.fillText(clampText(config.cardTagline, 50), textX, 198);

  // Footer: member count + handle
  ctx.fillStyle = '#6B7280';
  ctx.font = '18px "Liberation Sans", sans-serif';
  const handle = clampText(`@${member.user.username}`, 24);
  ctx.fillText(handle, textX, 250);

  if (config.showMemberCount) {
    ctx.fillStyle = config.embedAccentColor;
    ctx.font = 'bold 20px "Liberation Sans", sans-serif';
    const memberLine = `MEMBER #${member.guild.memberCount.toLocaleString()}`;
    ctx.fillText(memberLine, textX, 280);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Convenience wrapper that returns the rendered card already packaged as a
 * Discord attachment, ready to be set as `embed.setImage("attachment://...")`.
 */
export async function buildWelcomeAttachment(
  member: GuildMember,
  config: WelcomeConfigData
): Promise<{ attachment: AttachmentBuilder; filename: string }> {
  const buffer = await renderWelcomeCard({ member, config });
  const filename = `welcome-${member.id}.png`;
  return {
    attachment: new AttachmentBuilder(buffer, { name: filename }),
    filename,
  };
}
