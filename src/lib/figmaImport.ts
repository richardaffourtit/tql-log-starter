export interface FigmaColor {
    name: string;
    hex: string;
}

export interface FigmaText {
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
}

export interface FigmaFrame {
    id: string;
    name: string;
    thumbnailUrl?: string;
    pageName: string;
}

export interface FigmaSummary {
    fileKey: string;
    name: string;
    colors: FigmaColor[];
    textStyles: FigmaText[];
    frames: FigmaFrame[];
}

const FIGMA_BASE = 'https://api.figma.com/v1';

export function parseFigmaUrl(input: string): string | null {
    const trimmed = input.trim();
    const m = trimmed.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
    return null;
}

function rgbaToHex(c: { r: number; g: number; b: number; a?: number }): string {
    const r = Math.round((c.r ?? 0) * 255);
    const g = Math.round((c.g ?? 0) * 255);
    const b = Math.round((c.b ?? 0) * 255);
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

async function figmaFetch<T>(path: string, token: string): Promise<T> {
    const res = await fetch(`${FIGMA_BASE}${path}`, {
        headers: { 'X-Figma-Token': token }
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Figma ${res.status}: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
}

interface FileResponse {
    name: string;
    document: any;
    styles: Record<string, { name: string; styleType: string }>;
}

function walkNodes(node: any, visit: (n: any, pageName: string) => void, pageName = '') {
    if (!node) return;
    const nextPage = node.type === 'CANVAS' ? node.name : pageName;
    visit(node, nextPage);
    if (Array.isArray(node.children)) {
        for (const c of node.children) walkNodes(c, visit, nextPage);
    }
}

export async function fetchFigmaSummary(fileKey: string, token: string): Promise<FigmaSummary> {
    const file = await figmaFetch<FileResponse>(`/files/${fileKey}`, token);

    const colors: FigmaColor[] = [];
    const textStyles: FigmaText[] = [];
    const frames: FigmaFrame[] = [];
    const colorSeen = new Set<string>();
    const textSeen = new Set<string>();

    walkNodes(file.document, (n, pageName) => {
        if (n.type === 'FRAME' && pageName) {
            frames.push({ id: n.id, name: n.name, pageName });
        }
        if (Array.isArray(n.fills)) {
            for (const f of n.fills) {
                if (f.type === 'SOLID' && f.color) {
                    const hex = rgbaToHex(f.color);
                    const styleId = n.styles?.fill ? file.styles[n.styles.fill]?.name : undefined;
                    const name = styleId ?? hex;
                    const key = `${name}|${hex}`;
                    if (!colorSeen.has(key)) {
                        colorSeen.add(key);
                        colors.push({ name, hex });
                    }
                }
            }
        }
        if (n.style && n.type === 'TEXT') {
            const styleId = n.styles?.text ? file.styles[n.styles.text]?.name : undefined;
            const key = styleId ?? `${n.style.fontFamily}-${n.style.fontSize}-${n.style.fontWeight}`;
            if (!textSeen.has(key)) {
                textSeen.add(key);
                textStyles.push({
                    name: styleId ?? n.name,
                    fontFamily: n.style.fontFamily,
                    fontSize: n.style.fontSize,
                    fontWeight: n.style.fontWeight
                });
            }
        }
    });

    const MAX_FRAMES = 24;
    const topFrames = frames.slice(0, MAX_FRAMES);
    if (topFrames.length) {
        const ids = topFrames.map((f) => f.id).join(',');
        try {
            const images = await figmaFetch<{ images: Record<string, string | null> }>(
                `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1`,
                token
            );
            for (const f of topFrames) {
                f.thumbnailUrl = images.images?.[f.id] ?? undefined;
            }
        } catch {
            // thumbnails optional
        }
    }

    return {
        fileKey,
        name: file.name,
        colors: colors.slice(0, 64),
        textStyles: textStyles.slice(0, 32),
        frames: topFrames
    };
}
