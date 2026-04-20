export const CONTENTMINT_BRAND = {
    name: 'contentmint',
    byline: 'by g00dweird',
    ink: '#0b0b0b',
    primary: '#7b2bff',
    primaryLight: '#a855f7',
    accentPink: '#e46ca0',
    accentGreen: '#8fc9a0',
    gradientAngle: 135,
    chromaGreen: '#00e000',
    chromaBlue: '#0057ff'
} as const;

export const MIDJOURNEY_ALPHA = {
    profileId: '600fa5a6-9245-41ca-b883-d67a216e534f_7_main',
    profileFlag: '--profile 600fa5a6-9245-41ca-b883-d67a216e534f_7_main',
    defaultStyle: '--s 500',
    aspectVertical: '--ar 9:16',
    aspectSquare: '--ar 1:1',
    aspectLandscape: '--ar 16:9'
} as const;

export const AESTHETIC_KEYWORDS = [
    'glitch-grid',
    'chromatic aberration',
    'soft neon pastel',
    'pink-to-green gradient wash',
    'CRT scanline texture',
    'datamosh displacement',
    'analog tape bleed',
    'low-saturation cyber pastel',
    'tile-mosh fragmentation',
    'clean geometric type over chaotic canvas'
] as const;

export function buildMidjourneyPrompt(
    subject: string,
    opts: {
        aspect?: 'vertical' | 'square' | 'landscape';
        extraKeywords?: string[];
        stylize?: number;
    } = {}
): string {
    const { aspect = 'vertical', extraKeywords = [], stylize } = opts;
    const keywords = [...AESTHETIC_KEYWORDS.slice(0, 4), ...extraKeywords].join(', ');
    const ar =
        aspect === 'vertical'
            ? MIDJOURNEY_ALPHA.aspectVertical
            : aspect === 'square'
                ? MIDJOURNEY_ALPHA.aspectSquare
                : MIDJOURNEY_ALPHA.aspectLandscape;
    const s = stylize != null ? `--s ${stylize}` : MIDJOURNEY_ALPHA.defaultStyle;
    return `${subject}, ${keywords} ${ar} ${s} ${MIDJOURNEY_ALPHA.profileFlag}`;
}
