export type SourceProvider = 'archive.org' | 'pexels' | 'pixabay' | 'wikimedia' | 'user';

export interface VideoSource {
    provider: SourceProvider;
    id: string;
    title: string;
    author?: string;
    thumbnail?: string;
    videoUrl: string;
    duration?: number;
    width?: number;
    height?: number;
    license?: string;
    pageUrl?: string;
    addedAt?: number;
}

export function parseArchiveUrl(input: string): string | null {
    const trimmed = input.trim();
    const mDetails = trimmed.match(/archive\.org\/details\/([^/?#]+)/i);
    if (mDetails) return mDetails[1];
    const mDownload = trimmed.match(/archive\.org\/download\/([^/?#]+)/i);
    if (mDownload) return mDownload[1];
    if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return trimmed;
    return null;
}

interface ArchiveMetadata {
    files: { name: string; format: string; length?: string; size?: string }[];
    metadata: { title?: string; creator?: string; licenseurl?: string };
}

export async function fetchArchiveItem(identifier: string): Promise<VideoSource | null> {
    const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ArchiveMetadata;
    const video = data.files.find(
        (f) => /mp4|webm|mov/i.test(f.format) || /\.(mp4|webm|mov)$/i.test(f.name)
    );
    if (!video) return null;
    const thumb = data.files.find((f) => /thumb|jpg|jpeg|png/i.test(f.name));
    return {
        provider: 'archive.org',
        id: identifier,
        title: data.metadata.title ?? identifier,
        author: data.metadata.creator,
        videoUrl: `https://archive.org/download/${identifier}/${video.name}`,
        thumbnail: thumb ? `https://archive.org/download/${identifier}/${thumb.name}` : undefined,
        duration: video.length ? parseArchiveDuration(video.length) : undefined,
        license: data.metadata.licenseurl,
        pageUrl: `https://archive.org/details/${identifier}`
    };
}

function parseArchiveDuration(s: string): number | undefined {
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    const parts = s.split(':').map(Number);
    if (parts.some(Number.isNaN)) return undefined;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return undefined;
}

export async function searchPexels(query: string, apiKey: string, perPage = 12): Promise<VideoSource[]> {
    if (!apiKey) throw new Error('Pexels API key required — set PEXELS_API_KEY');
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const data = await res.json();
    return (data.videos ?? []).map((v: any) => {
        const best = (v.video_files ?? []).find((f: any) => f.quality === 'hd') ?? v.video_files?.[0];
        return {
            provider: 'pexels',
            id: String(v.id),
            title: v.url?.split('/').filter(Boolean).pop() ?? `Pexels ${v.id}`,
            author: v.user?.name,
            videoUrl: best?.link ?? '',
            thumbnail: v.image,
            duration: v.duration,
            width: v.width,
            height: v.height,
            license: 'Pexels License (free to use, attribution appreciated)',
            pageUrl: v.url
        } as VideoSource;
    });
}

export async function searchPixabay(query: string, apiKey: string, perPage = 12): Promise<VideoSource[]> {
    if (!apiKey) throw new Error('Pixabay API key required — set PIXABAY_API_KEY');
    const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);
    const data = await res.json();
    return (data.hits ?? []).map((v: any) => {
        const videos = v.videos ?? {};
        const best = videos.medium ?? videos.small ?? videos.large ?? videos.tiny;
        return {
            provider: 'pixabay',
            id: String(v.id),
            title: v.tags ?? `Pixabay ${v.id}`,
            author: v.user,
            videoUrl: best?.url ?? '',
            thumbnail: videos.large?.thumbnail ?? videos.medium?.thumbnail,
            duration: v.duration,
            width: best?.width,
            height: best?.height,
            license: 'Pixabay License',
            pageUrl: v.pageURL
        } as VideoSource;
    });
}

const LIBRARY_KEY = 'contentmint:user-library';

export function loadUserLibrary(): VideoSource[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(LIBRARY_KEY);
        return raw ? (JSON.parse(raw) as VideoSource[]) : [];
    } catch {
        return [];
    }
}

export function saveToUserLibrary(source: VideoSource) {
    if (typeof window === 'undefined') return;
    const lib = loadUserLibrary();
    const withTime = { ...source, addedAt: Date.now() };
    const existing = lib.findIndex((s) => s.provider === source.provider && s.id === source.id);
    if (existing >= 0) lib[existing] = withTime;
    else lib.unshift(withTime);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib.slice(0, 200)));
}

export function removeFromUserLibrary(provider: SourceProvider, id: string) {
    if (typeof window === 'undefined') return;
    const lib = loadUserLibrary().filter((s) => !(s.provider === provider && s.id === id));
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
}
