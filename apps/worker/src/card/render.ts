import { ImageResponse } from 'workers-og';
import pressStart from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff';
import vt323 from '@fontsource/vt323/files/vt323-latin-400-normal.woff';
import { CARD, cardHtml, type CardData } from './template';

/** Rasterise the share card to PNG bytes (satori -> resvg, both WASM). */
export async function renderCardPng(data: CardData): Promise<ArrayBuffer> {
  const res = new ImageResponse(cardHtml(data), {
    width: CARD.width,
    height: CARD.height,
    format: 'png',
    fonts: [
      { name: 'Press Start 2P', data: pressStart, weight: 400, style: 'normal' },
      { name: 'VT323', data: vt323, weight: 400, style: 'normal' },
    ],
  });
  return res.arrayBuffer();
}
