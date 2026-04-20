export interface Palette {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    grid: string;
    string: string;
    muted: string;
}

export type PaletteName = 'contentmint' | 'glitch' | 'amber' | 'mono' | 'acid' | 'blood';

export const PALETTES: Record<PaletteName, Palette> = {
    contentmint: {
        primary: '#7b2bff',
        secondary: '#e46ca0',
        accent: '#8fc9a0',
        bg: '#0b0b0b',
        grid: '#1c1c22',
        string: '#cfcfd8',
        muted: '#6b6b70'
    },
    glitch: {
        primary: '#00ffee',
        secondary: '#ff00c8',
        accent: '#ffff00',
        bg: '#000000',
        grid: '#2a2a44',
        string: '#b0b0d0',
        muted: '#888'
    },
    amber: {
        primary: '#ffb800',
        secondary: '#ff6a00',
        accent: '#fff0a8',
        bg: '#0a0800',
        grid: '#2a1f00',
        string: '#8a7a3a',
        muted: '#8a7a3a'
    },
    mono: {
        primary: '#f0f0f0',
        secondary: '#909090',
        accent: '#ffffff',
        bg: '#000000',
        grid: '#222222',
        string: '#888888',
        muted: '#777'
    },
    acid: {
        primary: '#00ff88',
        secondary: '#ffff00',
        accent: '#00ffee',
        bg: '#000800',
        grid: '#0a2a10',
        string: '#50a070',
        muted: '#50a070'
    },
    blood: {
        primary: '#ff0040',
        secondary: '#ff3080',
        accent: '#ffffff',
        bg: '#100000',
        grid: '#2a0010',
        string: '#a04060',
        muted: '#a04060'
    }
};

export const PALETTE_SWATCH: Record<PaletteName, string> = {
    contentmint: 'linear-gradient(45deg, #7b2bff 0%, #e46ca0 50%, #8fc9a0 100%)',
    glitch: 'linear-gradient(45deg, #ff00c8 0%, #00ffee 100%)',
    amber: '#ffb800',
    mono: '#f0f0f0',
    acid: 'linear-gradient(45deg, #00ff88 0%, #ffff00 100%)',
    blood: '#ff0040'
};
