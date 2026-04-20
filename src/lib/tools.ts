export interface ToolMeta {
    slug: string;
    name: string;
    tagline: string;
    description: string;
    status: 'live' | 'beta' | 'stub';
    href: string;
    accent: string;
}

export const TOOLS: ToolMeta[] = [
    {
        slug: 'video-studio',
        name: 'Video Studio',
        tagline: 'MIDI · MusicXML · GuitarPro → 9:16 video',
        description:
            'Drop a track + score. Scroll tab, staff notation, chromatic note readouts, spectrum, waveform. Export to WebM with chroma or alpha background for CapCut.',
        status: 'live',
        href: '/tools/video-studio',
        accent: '#7b2bff'
    },
    {
        slug: 'elements',
        name: 'Elements',
        tagline: 'Midjourney Alpha prompt pipeline',
        description:
            'Generate on-brand Midjourney Alpha prompts for images and typography. Applies the contentmint / g00dweird aesthetic, with export presets for CapCut overlays.',
        status: 'beta',
        href: '/tools/elements',
        accent: '#e46ca0'
    },
    {
        slug: 'volumetric',
        name: 'Volumetric',
        tagline: 'Single-voice → floating 3D blob',
        description:
            'Monophonic MIDI becomes a floating blob — size from velocity/duration, color from pitch — drifting on a rotating axis. Each past note leaves a tapered onion-skin trail that fades off behind it. Exports with chroma or alpha background.',
        status: 'stub',
        href: '/tools/volumetric',
        accent: '#8fc9a0'
    }
];

export const EXPORT_MODES = [
    { value: 'branded', label: 'Branded', hint: 'Pink → green gradient' },
    { value: 'chroma-green', label: 'Chroma green', hint: '#00e000 · key in CapCut' },
    { value: 'chroma-blue', label: 'Chroma blue', hint: '#0057ff · key in CapCut' },
    { value: 'alpha-black', label: 'Alpha on black', hint: 'Luma-key in CapCut' }
] as const;

export type ExportMode = (typeof EXPORT_MODES)[number]['value'];

export const CHROMA_COLORS: Record<ExportMode, { a: string; b: string; angle: number; label: string }> = {
    branded: { a: '#e46ca0', b: '#8fc9a0', angle: 135, label: 'Branded' },
    'chroma-green': { a: '#00e000', b: '#00e000', angle: 0, label: 'Chroma green' },
    'chroma-blue': { a: '#0057ff', b: '#0057ff', angle: 0, label: 'Chroma blue' },
    'alpha-black': { a: '#000000', b: '#000000', angle: 0, label: 'Alpha / black' }
};
