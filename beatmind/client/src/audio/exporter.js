// Encodage WAV (16 bits) / MP3 (lamejs) et téléchargement.
import { Mp3Encoder } from '@breezystack/lamejs';
import { zipSync } from 'fflate';

export function encodeWav(buffer) {
  const ch = Math.min(2, buffer.numberOfChannels);
  const len = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, buffer.sampleRate, true); data.setUint32(28, buffer.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}

const toInt16 = (f32) => {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

export async function encodeMp3(buffer, kbps = 192) {
  const stereo = buffer.numberOfChannels > 1;
  const enc = new Mp3Encoder(stereo ? 2 : 1, buffer.sampleRate, kbps);
  const left = toInt16(buffer.getChannelData(0));
  const right = stereo ? toInt16(buffer.getChannelData(1)) : null;
  const chunks = [];
  const block = 1152;
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const out = stereo ? enc.encodeBuffer(l, right.subarray(i, i + block)) : enc.encodeBuffer(l);
    if (out.length) chunks.push(new Uint8Array(out));
    if (i % (block * 200) === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const end = enc.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  return new Blob(chunks, { type: 'audio/mpeg' });
}

export async function encode(buffer, format) {
  return format === 'mp3' ? encodeMp3(buffer) : encodeWav(buffer);
}

export async function zipFiles(files) {
  const entries = {};
  for (const { name, blob } of files) entries[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
