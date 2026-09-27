"""Renders tools/lines.json into voice/<speaker>.mp3 banks plus voice/manifest.json.

Voices: Kokoro-82M (Apache-2.0), run locally with kokoro-onnx; Mandarin words use the macOS
"Meijia" (Taiwan) voice. Each clip is trimmed, loudness-levelled and MP3-encoded; the clips of one
speaker are joined into one file and the manifest stores [offset, length] per clip key.

Usage: python render-voice.py <kokoro-model-dir>   (needs ffmpeg and `brew install espeak-ng`; cached clips are reused)
"""
import json, os, subprocess, sys, tempfile
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache')
OUT = os.path.join(ROOT, 'voice')
MODEL_DIR = sys.argv[1]

# speaker -> (kokoro voice, speed, pitch factor). Pitch is raised by resampling only (no
# time-stretching, which warbles), so the model speaks a little slower to compensate.
VOICES = {
    'narr':   ('af_heart', 0.94, 1.0),
    'pip':    ('af_bella', 0.9, 1.12),
    'adult':  ('bf_emma', 0.96, 1.0),
    'pickle': ('bm_fable', 0.92, 1.1),
}
CHUNK = 1_500_000        # bytes per bank file, so the first lines load fast and files load in parallel

def tts_text(t):
    return (t.replace('’', "'").replace('‘', "'").replace('“', '').replace('”', '')
             .replace('…', '...').replace('—', ', ').replace('Pip’s', "Pip's"))

def clean(samples, sr):
    """Trim silence, level the loudness (no dynamic compression), fade the edges."""
    import numpy as np
    x = np.asarray(samples, dtype=np.float64)
    if x.ndim > 1: x = x.mean(axis=1)
    peak = np.abs(x).max() or 1.0
    frame = int(sr * 0.01)
    env = np.array([np.abs(x[i:i + frame]).max() for i in range(0, len(x), frame)])
    on = np.where(env > peak * 0.012)[0]                         # about -38 dB below the peak
    if len(on):
        a, b = max(0, (on[0] - 3) * frame), min(len(x), (on[-1] + 6) * frame)
        x = x[a:b]
    voiced = x[np.abs(x) > peak * 0.05]
    rms = np.sqrt((voiced ** 2).mean()) if len(voiced) else peak / 4
    x = x * (10 ** (-18 / 20) / rms)                              # speech level about -18 dBFS
    p = np.abs(x).max()
    if p > 0.89: x = x * (0.89 / p)                              # peaks stay under -1 dBFS
    f = int(sr * 0.008); ramp = np.linspace(0, 1, f)
    x[:f] *= ramp; x[-f:] *= ramp[::-1]
    return np.concatenate([x, np.zeros(int(sr * 0.05))]).astype('float32')

def encode(samples, sr, dst_mp3, pitch):
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'c.wav'); sf.write(wav, clean(samples, sr), sr, subtype='PCM_16')
        af = ['-af', f'asetrate={sr}*{pitch},aresample=24000:filter_size=128:cutoff=0.97'] if pitch != 1.0 else ['-ar', '24000']
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, *af, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k',
                        '-write_xing', '0', '-id3v2_version', '0', '-f', 'mp3', dst_mp3], check=True)

def main():
    os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(os.path.join(HERE, 'lines.json')))
    kokoro = None
    todo = [l for l in lines if not os.path.exists(os.path.join(CACHE, f"{l['who']}-{l['key']}.mp3"))]
    print(len(lines), 'lines,', len(todo), 'to render')
    for i, l in enumerate(todo):
        dst = os.path.join(CACHE, f"{l['who']}-{l['key']}.mp3")
        if l['who'] == 'zh':
            with tempfile.TemporaryDirectory() as tmp:
                aiff = os.path.join(tmp, 'a.aiff')
                subprocess.run(['say', '-v', 'Meijia', '-r', '140', '-o', aiff, l['text']], check=True)
                samples, sr = sf.read(aiff)
            encode(samples, sr, dst, 1.0)
        else:
            if kokoro is None:
                from kokoro_onnx import Kokoro, EspeakConfig
                # Homebrew's espeak-ng (brew install espeak-ng); the wheel's bundled copy has a broken data path on macOS.
                esp = EspeakConfig(lib_path='/opt/homebrew/lib/libespeak-ng.dylib', data_path='/opt/homebrew/share/espeak-ng-data')
                kokoro = Kokoro(os.path.join(MODEL_DIR, 'kokoro-v1.0.onnx'), os.path.join(MODEL_DIR, 'voices-v1.0.bin'), espeak_config=esp)
            voice, speed, pitch = VOICES[l['who']]
            lang = 'en-gb' if voice.startswith('b') else 'en-us'
            samples, sr = kokoro.create(tts_text(l['text']), voice=voice, speed=speed, lang=lang)
            encode(samples, sr, dst, pitch)
        if i % 25 == 0: print(i, l['who'], l['text'][:60], flush=True)
    # Pack each speaker's clips into ~1.5 MB bank files: voice/<who>-<n>.mp3.
    for f in os.listdir(OUT):
        if f.endswith('.mp3'): os.remove(os.path.join(OUT, f))
    manifest = {'v': 2, 'banks': {}, 'files': {}}
    for who in sorted({l['who'] for l in lines}):
        offs, blobs = {}, [bytearray()]
        for l in lines:
            if l['who'] != who: continue
            data = open(os.path.join(CACHE, f"{who}-{l['key']}.mp3"), 'rb').read()
            if len(blobs[-1]) and len(blobs[-1]) + len(data) > CHUNK: blobs.append(bytearray())
            offs[l['key']] = [len(blobs) - 1, len(blobs[-1]), len(data)]; blobs[-1] += data
        for n, blob in enumerate(blobs): open(os.path.join(OUT, f'{who}-{n}.mp3'), 'wb').write(blob)
        manifest['banks'][who] = offs; manifest['files'][who] = len(blobs)
        print(who, len(offs), 'clips', len(blobs), 'files', round(sum(map(len, blobs)) / 1024), 'KB')
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))

if __name__ == '__main__':
    main()
