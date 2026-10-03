"""Renders lines.json into voice/<key>.mp3 (one small file per line).

Voice: Kokoro-82M (Apache-2.0) "af_heart", run locally with kokoro-onnx — the same narrator and
settings as Blow Up (see blow-up/tools/render-voice.py): trim, plain gain levelling to about
-18 dBFS (no single-pass loudnorm), 64 kbps mono MP3 through a WAV intermediate.

Usage: python render-voice.py <kokoro-model-dir>   (needs ffmpeg and `brew install espeak-ng`)
Re-renders only lines whose text changed (cached in tools/.cache, which is not committed).
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'voice')
CACHE = os.path.join(HERE, '.cache')
VOICE, SPEED = 'af_heart', 0.94

def clean(x, sr):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim > 1: x = x.mean(axis=1)
    peak = np.abs(x).max() or 1.0
    frame = int(sr * 0.01)
    env = np.array([np.abs(x[i:i + frame]).max() for i in range(0, len(x), frame)])
    on = np.where(env > peak * 0.012)[0]
    if len(on): x = x[max(0, (on[0] - 3) * frame):min(len(x), (on[-1] + 6) * frame)]
    voiced = x[np.abs(x) > peak * 0.05]
    rms = np.sqrt((voiced ** 2).mean()) if len(voiced) else peak / 4
    x = x * (10 ** (-18 / 20) / rms)
    p = np.abs(x).max()
    if p > 0.89: x = x * (0.89 / p)
    f = int(sr * 0.008); ramp = np.linspace(0, 1, f)
    x[:f] *= ramp; x[-f:] *= ramp[::-1]
    return np.concatenate([x, np.zeros(int(sr * 0.05))]).astype('float32')

def main():
    model = sys.argv[1]
    os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(os.path.join(os.path.dirname(HERE), 'lines.json')))
    kokoro = None
    for l in lines:
        h = hashlib.sha1(f"{VOICE}|{SPEED}|{l['text']}".encode()).hexdigest()[:10]
        cached = os.path.join(CACHE, f"{l['key']}-{h}.mp3")
        if not os.path.exists(cached):
            if kokoro is None:
                from kokoro_onnx import Kokoro, EspeakConfig
                esp = EspeakConfig(lib_path='/opt/homebrew/lib/libespeak-ng.dylib', data_path='/opt/homebrew/share/espeak-ng-data')
                kokoro = Kokoro(os.path.join(model, 'kokoro-v1.0.onnx'), os.path.join(model, 'voices-v1.0.bin'), espeak_config=esp)
            samples, sr = kokoro.create(l['text'].replace('’', "'"), voice=VOICE, speed=SPEED, lang='en-us')
            with tempfile.TemporaryDirectory() as tmp:
                wav = os.path.join(tmp, 'c.wav'); sf.write(wav, clean(samples, sr), sr, subtype='PCM_16')
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame',
                                '-b:a', '64k', '-id3v2_version', '0', cached], check=True)
            print('rendered', l['key'])
        shutil.copyfile(cached, os.path.join(OUT, l['key'] + '.mp3'))
    keep = {l['key'] + '.mp3' for l in lines}
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f not in keep: os.remove(os.path.join(OUT, f))
    print(len(lines), 'lines in', OUT)

if __name__ == '__main__':
    main()
