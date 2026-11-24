/**
 * Draw skill VFX from champion atlas art + designer notes.
 * Procedural shapes only when the atlas marks `procedural` or no bitmap exists.
 */
import type { WatchAssets } from "./assets";
import { activeEffectsAt } from "./replay";
import {
  lookupVfx,
  smearFrames,
  statusVfxKeys,
  type ResolvedSprite,
  type VfxEntry,
} from "./vfx-atlas";
import type {
  Facing,
  MatchViewState,
  ProjectileFx,
  Team,
  UnitView,
} from "./types";

const TILE_W = 44;
const TILE_H = 32;
const ANCHOR_Y = 46;
/** Match body playfield scale — authored VFX cells are 1× bitmaps. */
const VFX_SCALE = 2;

function blitNearest(
  ctx: CanvasRenderingContext2D,
  imgSrc: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw = sw,
  dh = sh,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    imgSrc,
    Math.round(sx),
    Math.round(sy),
    Math.round(sw),
    Math.round(sh),
    Math.round(dx),
    Math.round(dy),
    Math.round(dw),
    Math.round(dh),
  );
}

const TEAM_HEX: Record<Team, string> = {
  blue: "#4DA3FF",
  red: "#F5477A",
};

export interface RenderVfxOpts {
  height: number;
}

function img(
  assets: WatchAssets,
  champ: string,
  file: string,
): HTMLImageElement | null {
  if (!file) return null;
  return assets.artImages[`${champ}/${file}`] ?? null;
}

function world(x: number, y: number): { px: number; py: number } {
  return { px: x * TILE_W, py: y * TILE_H };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function facingFromDelta(dx: number): Facing {
  return dx < 0 ? "left" : "right";
}

function drawDottedLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  width: number,
  dash: number[],
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawEllipseOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  width: number,
  dashed: boolean,
  fill?: string,
): void {
  ctx.save();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function blitSpriteAt(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  footX: number,
  footY: number,
  sprite: ResolvedSprite,
  frameIndex = 0,
  scale = VFX_SCALE,
): void {
  if (sprite.rect) {
    const [sx, sy, sw, sh] = sprite.rect;
    const [ax, ay] = sprite.anchor ?? [sw / 2, sh / 2];
    blitNearest(
      ctx,
      sheet,
      sx,
      sy,
      sw,
      sh,
      Math.round(footX - ax * scale),
      Math.round(footY - ay * scale),
      sw * scale,
      sh * scale,
    );
    return;
  }
  if (sprite.frame_size && sprite.frames) {
    const [fw, fh] = sprite.frame_size;
    const fi = frameIndex % sprite.frames;
    const [ox, oy] = sprite.origin_in_frame ?? [fw / 2, fh / 2];
    blitNearest(
      ctx,
      sheet,
      fi * fw,
      0,
      fw,
      fh,
      Math.round(footX - ox * scale),
      Math.round(footY - oy * scale),
      fw * scale,
      fh * scale,
    );
    return;
  }
  if (sprite.cell && sprite.frames) {
    const [cw, ch] = sprite.cell;
    const fi = frameIndex % sprite.frames;
    const dx = (sprite.offset_from_foot?.[0] ?? -Math.floor(cw / 2)) * scale;
    const dy = (sprite.offset_from_foot?.[1] ?? -ch) * scale;
    blitNearest(
      ctx,
      sheet,
      fi * cw,
      0,
      cw,
      ch,
      Math.round(footX + dx),
      Math.round(footY + dy),
      cw * scale,
      ch * scale,
    );
    return;
  }
  // Whole image, centered above feet slightly.
  const w = sheet.naturalWidth || sheet.width;
  const h = sheet.naturalHeight || sheet.height;
  const dx = (sprite.offset_from_foot?.[0] ?? -Math.floor(w / 2)) * scale;
  const dy = (sprite.offset_from_foot?.[1] ?? -h + 2) * scale;
  blitNearest(
    ctx,
    sheet,
    0,
    0,
    w,
    h,
    Math.round(footX + dx),
    Math.round(footY + dy),
    w * scale,
    h * scale,
  );
}

function resolveEntrySprite(
  assets: WatchAssets,
  champ: string,
  key: string,
  team: Team,
  facing: Facing,
): { sprite: ResolvedSprite; image: HTMLImageElement | null } | null {
  const sprite = lookupVfx(assets.vfxAtlases, champ, key, team, facing);
  if (!sprite) return null;
  if (sprite.procedural && !sprite.file && !sprite.rect) {
    return { sprite, image: null };
  }
  // Huntress rects live on vfx-sheet or dedicated pngs.
  if (sprite.rect) {
    const sheet =
      img(assets, champ, "vfx/vfx-sheet.png") ??
      img(assets, champ, sprite.file) ??
      null;
    return { sprite, image: sheet };
  }
  // Prefer dedicated file; also try team/facing filename patterns.
  let image = img(assets, champ, sprite.file);
  if (!image && key.startsWith("projectile-")) {
    image =
      img(assets, champ, `vfx/${key}-${team}.png`) ??
      img(assets, champ, `vfx/${key}.png`);
  }
  return { sprite, image };
}

function drawTelegraphs(
  ctx: CanvasRenderingContext2D,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
): void {
  for (const tele of active.telegraphs) {
    const caster = state.units[tele.unitId];
    if (!caster || !caster.alive) continue;
    const a = world(caster.x, caster.y);
    const target = tele.targetId
      ? state.units[tele.targetId as keyof typeof state.units]
      : null;
    const aim = world(
      target?.x ?? tele.aimX,
      target?.y ?? tele.aimY,
    );
    const color = TEAM_HEX[tele.team];
    const progress = clamp01(
      (state.t - tele.startedAt) / Math.max(1e-6, tele.endsAt - tele.startedAt),
    );
    const strong = tele.isUlt;

    if (tele.kind === "line" || tele.kind === "dotted-leash") {
      drawDottedLine(
        ctx,
        a.px,
        a.py,
        aim.px,
        aim.py,
        color,
        strong ? 2.5 : 1.5,
        tele.kind === "dotted-leash" ? [2, 4] : [4, 3],
      );
      // 1 px team core
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(aim.px, aim.py);
      ctx.stroke();
      ctx.restore();
    } else if (tele.kind === "cone") {
      const ang = Math.atan2(aim.py - a.py, aim.px - a.px);
      const len = Math.hypot(aim.px - a.px, aim.py - a.py) || tele.radius * TILE_W || 80;
      const half = ((tele.width > 0 ? 40 : 35) * Math.PI) / 180;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strong ? 2 : 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(
        a.px + Math.cos(ang - half) * len,
        a.py + Math.sin(ang - half) * len,
      );
      ctx.lineTo(
        a.px + Math.cos(ang + half) * len,
        a.py + Math.sin(ang + half) * len,
      );
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (
      tele.kind === "aoe" ||
      tele.kind === "double-ring" ||
      tele.kind === "self"
    ) {
      const r = Math.max(tele.radius, tele.kind === "self" ? 0.8 : 1.2);
      const rx = r * TILE_W * (0.55 + 0.45 * progress);
      const ry = r * TILE_H * (0.55 + 0.45 * progress);
      const c = tele.kind === "self" ? a : aim;
      drawEllipseOutline(
        ctx,
        c.px,
        c.py,
        rx,
        ry,
        color,
        strong ? 2.5 : 1.5,
        true,
        `${color}22`,
      );
      if (tele.kind === "double-ring" || strong) {
        drawEllipseOutline(
          ctx,
          c.px,
          c.py,
          rx * 0.82,
          ry * 0.82,
          color,
          1,
          true,
        );
      }
    } else if (tele.kind === "dash") {
      drawDottedLine(ctx, a.px, a.py, aim.px, aim.py, color, 2, [6, 4]);
    }
  }
}

function drawProjectileSprite(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  p: ProjectileFx,
  px: number,
  py: number,
  facing: Facing,
): boolean {
  const team = p.team;
  const champ = p.champ;
  if (!p.artKey) return false;

  // Huntress dedicated pngs / sheet rects
  if (p.artKey.startsWith("projectile-")) {
    const dedicated = img(assets, champ, `vfx/${p.artKey}-${team}.png`);
    if (dedicated) {
      const w = dedicated.naturalWidth || dedicated.width;
      const h = dedicated.naturalHeight || dedicated.height;
      blitNearest(
        ctx,
        dedicated,
        0,
        0,
        w,
        h,
        Math.round(px - (w * VFX_SCALE) / 2),
        Math.round(py - (h * VFX_SCALE) / 2),
        w * VFX_SCALE,
        h * VFX_SCALE,
      );
      return true;
    }
    const resolved = resolveEntrySprite(
      assets,
      champ,
      `${p.artKey}-${team}`,
      team,
      facing,
    );
    if (resolved?.image && resolved.sprite.rect) {
      blitSpriteAt(ctx, resolved.image, px, py, resolved.sprite);
      return true;
    }
  }

  const resolved = resolveEntrySprite(assets, champ, p.artKey, team, facing);
  if (resolved?.image) {
    blitSpriteAt(ctx, resolved.image, px, py, resolved.sprite);
    return true;
  }
  return false;
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
): void {
  for (const p of active.projectiles) {
    const dur = Math.max(1e-6, p.endedAt - p.spawnT);
    const u = clamp01((state.t - p.spawnT) / dur);
    const x = lerp(p.fromX, p.toX, u);
    const y = lerp(p.fromY, p.toY, u);
    const { px, py } = world(x, y);
    const facing = facingFromDelta(p.toX - p.fromX);

    // Delayed AoE lands: keep a ground ring at the aim while the shell travels.
    if (!p.isAuto && Math.hypot(p.toX - p.fromX, p.toY - p.fromY) > 0.05) {
      const meta = p.skillId;
      // Ring at destination for mortar / upwelling style spawns.
      if (p.landT - p.spawnT >= 0.4) {
        const dest = world(p.toX, p.toY);
        const rx = 1.4 * TILE_W;
        const ry = 1.4 * TILE_H;
        drawEllipseOutline(
          ctx,
          dest.px,
          dest.py,
          rx,
          ry,
          TEAM_HEX[p.team],
          2,
          true,
          `${TEAM_HEX[p.team]}18`,
        );
        void meta;
      }
    }

    const drawn = drawProjectileSprite(ctx, assets, p, px, py, facing);

    if (p.trail === "bronze-leash") {
      const caster = state.units[p.unitId];
      if (caster) {
        const c = world(caster.x, caster.y);
        drawDottedLine(ctx, c.px, c.py, px, py, "#B08A4A", 1.5, [2, 3]);
      }
    } else if (p.trail === "iron-chain") {
      const caster = state.units[p.unitId];
      if (caster) {
        const c = world(caster.x, caster.y);
        drawDottedLine(ctx, c.px, c.py - 10, px, py, "#8A9098", 1.5, [3, 2]);
      }
    } else if (p.trail === "spark") {
      ctx.save();
      ctx.fillStyle = "#F2C14E";
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) {
        const t = clamp01(u - i * 0.08);
        const sx = lerp(p.fromX, p.toX, t);
        const sy = lerp(p.fromY, p.toY, t);
        const s = world(sx, sy);
        ctx.fillRect(Math.round(s.px) - 1, Math.round(s.py) - 1, 2, 2);
      }
      ctx.restore();
    }

    if (!drawn) {
      // Fallback only when no atlas bitmap resolved.
      ctx.save();
      ctx.fillStyle = TEAM_HEX[p.team];
      ctx.beginPath();
      ctx.arc(px, py - 4, p.isAuto ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawHitFlashes(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
): void {
  for (const flash of active.hitFlashes) {
    const unit = state.units[flash.targetId];
    if (!unit) continue;
    const { px, py } = world(unit.x, unit.y);
    const age = state.t - flash.startedAt;
    const frame = Math.floor(age * 20);

    // Skill hit ring (distinct from auto hit anim).
    ctx.save();
    ctx.strokeStyle = "#F2E6C8";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - clamp01(age / HIT_FLASH_FALLBACK);
    ctx.beginPath();
    ctx.ellipse(px, py - 12, 14 + frame * 2, 8 + frame, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (const key of flash.impactKeys) {
      const casterFacing = unit.facing;
      const resolved = resolveEntrySprite(
        assets,
        flash.champ,
        key,
        unit.team,
        casterFacing,
      );
      if (resolved?.image) {
        blitSpriteAt(
          ctx,
          resolved.image,
          px,
          py - 8,
          resolved.sprite,
          frame,
        );
      }
    }

    // Huntress impact frames
    if (flash.champ === "huntress") {
      const impactKey = `impact-${unit.team === "blue" ? "blue" : "red"}`;
      // Prefer dedicated png, else sheet rects from source team.
      const dedicated = img(assets, "huntress", `vfx/${impactKey}.png`);
      if (dedicated) {
        const w = dedicated.naturalWidth || dedicated.width;
        const h = dedicated.naturalHeight || dedicated.height;
        // strip assumed horizontal if wide
        const cells = Math.max(1, Math.floor(w / Math.max(h, 1)));
        const cw = Math.floor(w / cells);
        const fi = frame % cells;
        blitNearest(
          ctx,
          dedicated,
          fi * cw,
          0,
          cw,
          h,
          Math.round(px - cw / 2),
          Math.round(py - 16),
          cw,
          h,
        );
      }
    }
  }
}

const HIT_FLASH_FALLBACK = 0.22;

function drawStatusIcons(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
): void {
  // Group by target for stacking.
  const byTarget = new Map<string, typeof active.statuses>();
  for (const s of active.statuses) {
    const list = byTarget.get(s.targetId) ?? [];
    list.push(s);
    byTarget.set(s.targetId, list);
  }
  for (const [targetId, list] of byTarget) {
    const unit = state.units[targetId as keyof typeof state.units] as
      | UnitView
      | undefined;
    if (!unit || !unit.alive) continue;
    const { px, py } = world(unit.x, unit.y);
    let slot = 0;
    for (const st of list) {
      let drawn = false;
      for (const key of statusVfxKeys(st.kind)) {
        // Prefer the target champ's plate, then any loaded plate of that key.
        const tryChamps = [unit.champ, ...Object.keys(assets.vfxAtlases)];
        for (const champ of tryChamps) {
          const resolved = resolveEntrySprite(
            assets,
            champ,
            key,
            unit.team,
            unit.facing,
          );
          if (!resolved?.image) continue;
          const ox = slot * 10 - ((list.length - 1) * 10) / 2;
          // Sleep to the right of HP bar per Sedge notes; others above head.
          const headY =
            st.kind === "sleep"
              ? py - ANCHOR_Y + 4
              : st.kind === "root" || st.kind === "slow"
                ? py - 4
                : py - ANCHOR_Y - 4;
          const headX = st.kind === "sleep" ? px + 14 : px + ox;
          const age = state.t - st.startedAt;
          const fi = Math.floor(age * 8);
          blitSpriteAt(
            ctx,
            resolved.image,
            headX,
            headY,
            {
              ...resolved.sprite,
              offset_from_foot:
                st.kind === "root"
                  ? [-6, -2]
                  : st.kind === "slow"
                    ? [-6, -2]
                    : resolved.sprite.offset_from_foot ?? [-8, -14],
            },
            fi,
          );
          drawn = true;
          break;
        }
        if (drawn) break;
      }
      if (!drawn) {
        // Procedural fallback glyph.
        const ox = slot * 10 - ((list.length - 1) * 10) / 2;
        drawProceduralStatus(ctx, px + ox, py - ANCHOR_Y - 8, st.kind, unit.team);
      }
      slot += 1;
    }
  }
}

function drawProceduralStatus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  team: Team,
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const color = TEAM_HEX[team];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  switch (kind) {
    case "stun":
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.moveTo(0, -3);
      ctx.lineTo(0, 3);
      ctx.stroke();
      break;
    case "slow":
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(-1, -2);
      ctx.lineTo(3, 2);
      ctx.lineTo(6, -1);
      ctx.stroke();
      break;
    case "root":
      ctx.beginPath();
      ctx.ellipse(0, 3, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "silence":
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3.5, 3.5);
      ctx.lineTo(3.5, -3.5);
      ctx.stroke();
      break;
    case "taunt":
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(0, -4);
      ctx.lineTo(4, 3);
      ctx.closePath();
      ctx.stroke();
      break;
    case "shield":
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    default:
      ctx.fillRect(-3, -3, 6, 6);
  }
  ctx.restore();
}

function drawSkillTags(
  ctx: CanvasRenderingContext2D,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
): void {
  for (const tag of active.skillTags) {
    const unit = state.units[tag.unitId];
    if (!unit || !unit.alive) continue;
    const { px, py } = world(unit.x, unit.y);
    const label = `${tag.skillKey} · ${tag.skillName}`;
    const age = state.t - tag.startedAt;
    const alpha = 1 - clamp01(age / 0.85);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 9px Barlow Condensed, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#0B0E14";
    ctx.fillText(label, px + 1, py - ANCHOR_Y - 10);
    ctx.fillStyle = TEAM_HEX[tag.team];
    ctx.fillText(label, px, py - ANCHOR_Y - 11);
    ctx.restore();
  }
}

function drawUltPulses(
  ctx: CanvasRenderingContext2D,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
  height: number,
): void {
  for (const pulse of active.ultPulses) {
    const unit = state.units[pulse.unitId];
    const x = unit?.x ?? pulse.x;
    const y = unit?.y ?? pulse.y;
    const { px, py } = world(x, y);
    if (py >= height) continue;
    const u = clamp01(
      (state.t - pulse.startedAt) /
        Math.max(1e-6, pulse.endsAt - pulse.startedAt),
    );
    const color = TEAM_HEX[pulse.team];
    const r = 12 + u * 36;
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMeleeSmears(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  active: ReturnType<typeof activeEffectsAt>,
): void {
  // During cast of smear skills, blit the frame-matched smear strip.
  for (const tele of active.telegraphs) {
    const unit = state.units[tele.unitId];
    if (!unit) continue;
    const block = assets.vfxAtlases[unit.champ];
    if (!block) continue;
    // Find any smear entry
    for (const [key, entry] of Object.entries(block)) {
      if (!key.includes("smear")) continue;
      // Only while this champ's matching cast is active.
      const frames = smearFrames(entry as VfxEntry);
      if (frames.length === 0) continue;
      const recipeKeys = [
        tele.skillKey === "W" ? "spool-cut-smear" : "",
        tele.skillKey === "R" ? "reeling-cut-smear" : "",
        tele.skillKey === "Q" ? "tide-cleave-smear" : "",
        tele.skillKey === "R" ? "keelbreak-smear" : "",
        tele.skillKey === "Q" ? "shell-slam-smear" : "",
      ].filter(Boolean);
      if (!recipeKeys.includes(key) && !key.includes(tele.skillKey.toLowerCase())) {
        // Match by skill recipe smear field via open cast skill name heuristics
        const skillLower = tele.skillId.toLowerCase();
        const ok =
          (key.includes("spool") && skillLower.includes("spool")) ||
          (key.includes("reeling") && skillLower.includes("reeling")) ||
          (key.includes("tide") && skillLower.includes("tide")) ||
          (key.includes("keel") && skillLower.includes("keel")) ||
          (key.includes("shell") && skillLower.includes("shell"));
        if (!ok) continue;
      }
      const elapsed = state.t - tele.startedAt;
      // Approximate body frame from cast progress (atlas ms ~100).
      const bodyFrame = Math.floor(elapsed * 10);
      const hit = frames.find((f) => f.frame === bodyFrame) ??
        frames.find((f) => f.frame <= bodyFrame);
      if (!hit) continue;
      const image = img(assets, unit.champ, hit.file);
      if (!image) continue;
      const { px, py } = world(unit.x, unit.y);
      const [ox, oy] = hit.offset_from_anchor ?? [0, -12];
      const w = image.naturalWidth || image.width;
      const h = image.naturalHeight || image.height;
      blitNearest(
        ctx,
        image,
        0,
        0,
        w,
        h,
        Math.round(px + ox * VFX_SCALE - 9 * VFX_SCALE),
        Math.round(py + oy * VFX_SCALE - 23 * VFX_SCALE),
        w * VFX_SCALE,
        h * VFX_SCALE,
      );
    }
  }
}

/** Deterministic ult shake from active pulses (no drawing). */
export function ultShakeAt(
  state: MatchViewState,
): { shakeX: number; shakeY: number } {
  const active = activeEffectsAt(state.effects, state.t);
  let shakeX = 0;
  let shakeY = 0;
  for (const pulse of active.ultPulses) {
    const u = clamp01(
      (state.t - pulse.startedAt) /
        Math.max(1e-6, pulse.endsAt - pulse.startedAt),
    );
    const phase = (state.t * 60) | 0;
    shakeX += ((phase % 3) - 1) * (1 - u) * 1.5;
    shakeY += (((phase * 2) % 3) - 1) * (1 - u) * 1.0;
  }
  return { shakeX, shakeY };
}

/**
 * Draw all active VFX over the arena (telegraphs → projectiles → hits →
 * status plates → tags). Ult ring pulses are included; shake is separate.
 */
export function renderVfx(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  opts: RenderVfxOpts,
): void {
  const active = activeEffectsAt(state.effects, state.t);
  drawUltPulses(ctx, state, active, opts.height);
  drawTelegraphs(ctx, state, active);
  drawMeleeSmears(ctx, assets, state, active);
  drawProjectiles(ctx, assets, state, active);
  drawHitFlashes(ctx, assets, state, active);
  drawStatusIcons(ctx, assets, state, active);
  drawSkillTags(ctx, state, active);
}

/** Count active effects — for e2e / debug attributes. */
export function countActiveVfx(state: MatchViewState): number {
  const a = activeEffectsAt(state.effects, state.t);
  return (
    a.telegraphs.length +
    a.projectiles.length +
    a.hitFlashes.length +
    a.statuses.length +
    a.skillTags.length +
    a.ultPulses.length
  );
}
