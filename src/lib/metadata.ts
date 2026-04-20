export type Platform = 'tiktok' | 'reels' | 'shorts' | 'x' | 'archive' | 'master';

export interface PlatformProfile {
    id: Platform;
    label: string;
    aspect: '9:16' | '1:1' | '16:9';
    maxDurationSec: number;
    preferredCodec: string;
    notes: string;
    hashtagsCap?: number;
}

export const PLATFORMS: PlatformProfile[] = [
    {
        id: 'tiktok',
        label: 'TikTok',
        aspect: '9:16',
        maxDurationSec: 180,
        preferredCodec: 'h264',
        notes: 'First 3s hook matters. Keep cue landing ≤1s in.',
        hashtagsCap: 5
    },
    {
        id: 'reels',
        label: 'Instagram Reels',
        aspect: '9:16',
        maxDurationSec: 90,
        preferredCodec: 'h264',
        notes: 'Caption visible behind bottom UI — keep content in safe zone.',
        hashtagsCap: 10
    },
    {
        id: 'shorts',
        label: 'YouTube Shorts',
        aspect: '9:16',
        maxDurationSec: 60,
        preferredCodec: 'h264',
        notes: 'Title + description drive discovery; pin comment with links.',
        hashtagsCap: 3
    },
    {
        id: 'x',
        label: 'X / Twitter',
        aspect: '16:9',
        maxDurationSec: 140,
        preferredCodec: 'h264',
        notes: 'Loop-friendly short clips punch hardest.'
    },
    {
        id: 'archive',
        label: 'Archive / master',
        aspect: '9:16',
        maxDurationSec: 600,
        preferredCodec: 'vp9',
        notes: 'Lossless-ish master you re-derive trims from.'
    },
    {
        id: 'master',
        label: 'Long-form master',
        aspect: '16:9',
        maxDurationSec: 3600,
        preferredCodec: 'vp9',
        notes: 'Full performance; trim per-platform shorts from here.'
    }
];

export interface ClipMetadata {
    project: string;
    variant: string;
    platform: Platform;
    cueAlignment?: { refCueName: string; refCueTime: number; alignTargetTime: number };
    tempo: { audioBpm: number; detectedBpm?: number; syncOffset: number };
    duration: number;
    preRoll: number;
    sourceStart: number;
    title?: string;
    subtitle?: string;
    caption?: string;
    hashtags?: string[];
    credits?: string[];
    lyrics?: string;
    palette?: { name: string; hex: string }[];
    sourceFiles?: { audio?: string; score?: string; archiveId?: string };
    cutMarkers?: number[];
    createdAt: number;
    tool: string;
    version: string;
}

export function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'untitled';
}

export function buildFilename(meta: ClipMetadata, ext = 'webm'): string {
    const project = slugify(meta.project || 'project');
    const variant = slugify(meta.variant || 'main');
    const platform = meta.platform;
    const stamp = new Date(meta.createdAt).toISOString().replace(/[:.]/g, '-').slice(0, 16);
    return `${project}_${platform}_${variant}_${stamp}.${ext}`;
}

export function buildDeployPath(meta: ClipMetadata, ext = 'webm'): string {
    const project = slugify(meta.project || 'project');
    const variant = slugify(meta.variant || 'main');
    return `contentmint-exports/${project}/${meta.platform}/${variant}/${buildFilename(meta, ext)}`;
}

export function buildSidecarJson(meta: ClipMetadata): string {
    return JSON.stringify(meta, null, 2);
}

export interface CaptionPack {
    platform: Platform;
    title: string;
    caption: string;
    hashtags: string[];
    cta?: string;
}

export function buildCaptionPack(
    meta: ClipMetadata,
    overrides: Partial<CaptionPack> = {}
): CaptionPack {
    const profile = PLATFORMS.find((p) => p.id === meta.platform);
    const baseHashtags = meta.hashtags ?? [];
    const cap = profile?.hashtagsCap ?? 10;
    return {
        platform: meta.platform,
        title: overrides.title ?? meta.title ?? meta.project,
        caption: overrides.caption ?? meta.caption ?? '',
        hashtags: (overrides.hashtags ?? baseHashtags).slice(0, cap),
        cta: overrides.cta
    };
}

export function formatCaption(pack: CaptionPack): string {
    const tagLine = pack.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    return [pack.caption, pack.cta, tagLine].filter(Boolean).join('\n\n');
}

export const METADATA_VERSION = '2026.04.1';

export function newMetadata(init: Partial<ClipMetadata> = {}): ClipMetadata {
    return {
        project: 'untitled',
        variant: 'main',
        platform: 'tiktok',
        tempo: { audioBpm: 120, syncOffset: 0 },
        duration: 0,
        preRoll: 0,
        sourceStart: 0,
        createdAt: Date.now(),
        tool: 'video-studio',
        version: METADATA_VERSION,
        ...init
    };
}
