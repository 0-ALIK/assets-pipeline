import sharp from 'sharp';
import { PipelineError } from '@assets-pipeline/core';
import type {
  AssetBuilder,
  AtlasBuildPlan,
  BuildArtifact,
  BuildRequest,
} from '@assets-pipeline/core';

interface AtlasRawSource {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

function copySprite(
  source: AtlasRawSource,
  target: Buffer,
  targetSize: number,
  placement: AtlasBuildPlan['pages'][number]['sprites'][number],
): void {
  const rect = placement.source;
  if (rect.x + rect.width > source.width || rect.y + rect.height > source.height) {
    throw new PipelineError(
      'INVALID_SOURCE',
      `La región de ${placement.id} ya no cabe en su archivo.`,
    );
  }
  const sourceBuffer = Buffer.from(
    source.data.buffer,
    source.data.byteOffset,
    source.data.byteLength,
  );
  for (let y = 0; y < rect.height; y += 1) {
    const sourceStart = ((rect.y + y) * source.width + rect.x) * 4;
    const targetStart = ((placement.y + y) * targetSize + placement.x) * 4;
    sourceBuffer.copy(target, targetStart, sourceStart, sourceStart + rect.width * 4);
  }
}

function buildPageMetadata(page: AtlasBuildPlan['pages'][number]): object {
  const sprites = Object.fromEntries(
    page.sprites
      .map(
        (sprite) =>
          [
            sprite.id,
            {
              x: sprite.x,
              y: sprite.y,
              width: sprite.width,
              height: sprite.height,
              pivot: sprite.pivot,
            },
          ] as const,
      )
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const animations = Object.fromEntries(
    page.animations
      .map(({ id, playback, frames }) => [id, { playback, frames }] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return { sprites, animations };
}

/**
 * Renders a Core atlas plan into PNG pages and JSON metadata. The Core build
 * service decodes the sources through the importers and passes the plan plus
 * the RGBA pixels in `options`; this adapter only composes and encodes.
 */
export class NodeAtlasBuilder implements AssetBuilder {
  readonly format = 'atlas-png';

  async build(request: BuildRequest): Promise<readonly BuildArtifact[]> {
    const plan = request.options.plan as AtlasBuildPlan | undefined;
    const sources = request.options.sources as ReadonlyMap<string, AtlasRawSource> | undefined;
    if (!plan || !sources) {
      throw new PipelineError(
        'INVALID_INPUT',
        'El build necesita el plan y las fuentes decodificadas.',
      );
    }
    const artifacts: BuildArtifact[] = [];
    for (const page of plan.pages) {
      const raw = Buffer.alloc(page.size * page.size * 4);
      for (const sprite of page.sprites) {
        const source = sources.get(sprite.sourcePath);
        if (!source) {
          throw new PipelineError(
            'INVALID_SOURCE',
            `Falta la fuente decodificada ${sprite.sourcePath}.`,
          );
        }
        copySprite(source, raw, page.size, sprite);
      }
      const png = await sharp(raw, {
        raw: { width: page.size, height: page.size, channels: 4 },
      })
        .png()
        .toBuffer();
      artifacts.push({ fileName: page.fileName, mediaType: 'image/png', contents: png });
      const metadataFile = `${page.fileName.slice(0, -4)}.json`;
      artifacts.push({
        fileName: metadataFile,
        mediaType: 'application/json',
        contents: Buffer.from(`${JSON.stringify(buildPageMetadata(page), null, 2)}\n`),
      });
    }
    artifacts.push({
      fileName: 'index.json',
      mediaType: 'application/json',
      contents: Buffer.from(`${JSON.stringify(plan.index, null, 2)}\n`),
    });
    return artifacts;
  }
}
