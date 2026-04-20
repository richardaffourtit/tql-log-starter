export interface BgRemovalResult {
    mask: ImageData;
    cutout: HTMLCanvasElement;
}

export interface DepthResult {
    depth: ImageData;
    min: number;
    max: number;
}

type AnyPipeline = (input: any, opts?: any) => Promise<any>;

let bgPipelinePromise: Promise<AnyPipeline> | null = null;
let depthPipelinePromise: Promise<AnyPipeline> | null = null;

async function getTransformers() {
    const mod: any = await import('@xenova/transformers');
    mod.env.allowLocalModels = false;
    return mod;
}

async function bgPipeline(): Promise<AnyPipeline> {
    if (!bgPipelinePromise) {
        bgPipelinePromise = (async () => {
            const t = await getTransformers();
            return t.pipeline('image-segmentation', 'Xenova/modnet');
        })();
    }
    return bgPipelinePromise;
}

async function depthPipeline(): Promise<AnyPipeline> {
    if (!depthPipelinePromise) {
        depthPipelinePromise = (async () => {
            const t = await getTransformers();
            return t.pipeline('depth-estimation', 'Xenova/depth-anything-small-hf');
        })();
    }
    return depthPipelinePromise;
}

function imageToDataUrl(img: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): string {
    const w = (img as any).videoWidth ?? (img as any).naturalWidth ?? (img as HTMLCanvasElement).width;
    const h = (img as any).videoHeight ?? (img as any).naturalHeight ?? (img as HTMLCanvasElement).height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img as any, 0, 0, w, h);
    return c.toDataURL('image/png');
}

export async function removeBackground(
    source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<BgRemovalResult> {
    const pipe = await bgPipeline();
    const dataUrl = imageToDataUrl(source);
    const result: any[] = await pipe(dataUrl);
    const fg = result.find((r: any) => /^(fg|person|portrait|subject)/i.test(r.label)) ?? result[0];
    const maskRaw = fg.mask;
    const w = maskRaw.width;
    const h = maskRaw.height;
    const maskData = new ImageData(w, h);
    const px = maskData.data;
    const mdata: Uint8Array = maskRaw.data;
    for (let i = 0; i < w * h; i++) {
        const v = mdata[i] ?? 0;
        px[i * 4] = v;
        px[i * 4 + 1] = v;
        px[i * 4 + 2] = v;
        px[i * 4 + 3] = 255;
    }
    const cutout = document.createElement('canvas');
    cutout.width = w;
    cutout.height = h;
    const cctx = cutout.getContext('2d')!;
    cctx.drawImage(source as any, 0, 0, w, h);
    const imgData = cctx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
        imgData.data[i * 4 + 3] = mdata[i] ?? 0;
    }
    cctx.putImageData(imgData, 0, 0);
    return { mask: maskData, cutout };
}

export async function estimateDepth(
    source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<DepthResult> {
    const pipe = await depthPipeline();
    const dataUrl = imageToDataUrl(source);
    const result: any = await pipe(dataUrl);
    const w = result.depth.width;
    const h = result.depth.height;
    const raw: Uint8Array | Float32Array = result.depth.data;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < raw.length; i++) {
        const v = raw[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const span = Math.max(1e-9, max - min);
    const depth = new ImageData(w, h);
    for (let i = 0; i < w * h; i++) {
        const v = Math.round(((raw[i] - min) / span) * 255);
        depth.data[i * 4] = v;
        depth.data[i * 4 + 1] = v;
        depth.data[i * 4 + 2] = v;
        depth.data[i * 4 + 3] = 255;
    }
    return { depth, min, max };
}

export async function warmupModels(): Promise<void> {
    await Promise.allSettled([bgPipeline(), depthPipeline()]);
}
