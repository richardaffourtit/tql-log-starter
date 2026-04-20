export type BrandAssetKind = 'image' | 'gif' | 'video' | 'header' | 'audio' | 'font';

export interface BrandAsset {
    id: string;
    kind: BrandAssetKind;
    name: string;
    url: string;
    thumbnail?: string;
    width?: number;
    height?: number;
    duration?: number;
    tags?: string[];
    addedAt: number;
}

export interface BrandCopy {
    id: string;
    slug: string;
    label: string;
    body: string;
    kind: 'bio' | 'tagline' | 'caption' | 'cta' | 'lyric' | 'credit' | 'custom';
    platforms?: string[];
    updatedAt: number;
}

export interface BrandLink {
    id: string;
    label: string;
    url: string;
    group?: 'social' | 'music' | 'merch' | 'press' | 'custom';
    icon?: string;
    updatedAt: number;
}

export interface BrandKit {
    name: string;
    tagline: string;
    palette: { name: string; hex: string }[];
    assets: BrandAsset[];
    copy: BrandCopy[];
    links: BrandLink[];
    updatedAt: number;
}

const KIT_KEY = 'contentmint:brand-kit';

export const DEFAULT_KIT: BrandKit = {
    name: 'g00dweird',
    tagline: 'contentmint · mono-voice visuals · glitch-pastel',
    palette: [
        { name: 'ink', hex: '#0b0b0b' },
        { name: 'primary', hex: '#7b2bff' },
        { name: 'primary-light', hex: '#a855f7' },
        { name: 'accent-pink', hex: '#e46ca0' },
        { name: 'accent-green', hex: '#8fc9a0' },
        { name: 'chroma-green', hex: '#00e000' },
        { name: 'chroma-blue', hex: '#0057ff' }
    ],
    assets: [],
    copy: [],
    links: [],
    updatedAt: 0
};

function makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadKit(): BrandKit {
    if (typeof window === 'undefined') return { ...DEFAULT_KIT };
    try {
        const raw = localStorage.getItem(KIT_KEY);
        if (!raw) return { ...DEFAULT_KIT };
        const parsed = JSON.parse(raw) as Partial<BrandKit>;
        return { ...DEFAULT_KIT, ...parsed };
    } catch {
        return { ...DEFAULT_KIT };
    }
}

export function saveKit(kit: BrandKit) {
    if (typeof window === 'undefined') return;
    const withTime = { ...kit, updatedAt: Date.now() };
    localStorage.setItem(KIT_KEY, JSON.stringify(withTime));
}

export function addAsset(kit: BrandKit, asset: Omit<BrandAsset, 'id' | 'addedAt'>): BrandKit {
    const full: BrandAsset = { ...asset, id: makeId(), addedAt: Date.now() };
    return { ...kit, assets: [full, ...kit.assets], updatedAt: Date.now() };
}

export function removeAsset(kit: BrandKit, id: string): BrandKit {
    return { ...kit, assets: kit.assets.filter((a) => a.id !== id), updatedAt: Date.now() };
}

export function upsertCopy(kit: BrandKit, entry: Omit<BrandCopy, 'id' | 'updatedAt'> & { id?: string }): BrandKit {
    const id = entry.id ?? makeId();
    const next: BrandCopy = {
        id,
        slug: entry.slug,
        label: entry.label,
        body: entry.body,
        kind: entry.kind,
        platforms: entry.platforms,
        updatedAt: Date.now()
    };
    const existing = kit.copy.findIndex((c) => c.id === id);
    const copy = [...kit.copy];
    if (existing >= 0) copy[existing] = next;
    else copy.unshift(next);
    return { ...kit, copy, updatedAt: Date.now() };
}

export function removeCopy(kit: BrandKit, id: string): BrandKit {
    return { ...kit, copy: kit.copy.filter((c) => c.id !== id), updatedAt: Date.now() };
}

export function upsertLink(kit: BrandKit, entry: Omit<BrandLink, 'id' | 'updatedAt'> & { id?: string }): BrandKit {
    const id = entry.id ?? makeId();
    const next: BrandLink = {
        id,
        label: entry.label,
        url: entry.url,
        group: entry.group,
        icon: entry.icon,
        updatedAt: Date.now()
    };
    const existing = kit.links.findIndex((l) => l.id === id);
    const links = [...kit.links];
    if (existing >= 0) links[existing] = next;
    else links.unshift(next);
    return { ...kit, links, updatedAt: Date.now() };
}

export function removeLink(kit: BrandKit, id: string): BrandKit {
    return { ...kit, links: kit.links.filter((l) => l.id !== id), updatedAt: Date.now() };
}

export function exportKit(kit: BrandKit): string {
    return JSON.stringify(kit, null, 2);
}

export function importKit(json: string): BrandKit {
    const parsed = JSON.parse(json) as Partial<BrandKit>;
    return { ...DEFAULT_KIT, ...parsed, updatedAt: Date.now() };
}

export function assetsByKind(kit: BrandKit, kind: BrandAssetKind): BrandAsset[] {
    return kit.assets.filter((a) => a.kind === kind);
}

export function copyByKind(kit: BrandKit, kind: BrandCopy['kind']): BrandCopy[] {
    return kit.copy.filter((c) => c.kind === kind);
}

export function linksByGroup(kit: BrandKit, group: NonNullable<BrandLink['group']>): BrandLink[] {
    return kit.links.filter((l) => l.group === group);
}
