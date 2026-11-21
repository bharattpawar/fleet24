"""Pack original partner-character renders into an Expo-compatible atlas."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops

parser = argparse.ArgumentParser()
parser.add_argument('role', choices=['rider', 'restaurant'])
parser.add_argument('frames', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--preview', type=Path)
args = parser.parse_args()
frames = [Image.open(args.frames / f'{i:02}.png').convert('RGBA') for i in range(48)]
assert all(frame.size == (480, 480) for frame in frames)
end = Image.open(args.frames / 'loop-end.png').convert('RGBA')
assert max(v[1] for v in ImageChops.difference(frames[0], end).getextrema()) <= 3, 'Loop endpoint differs.'
assert ImageChops.difference(frames[0], frames[12]).getbbox(alpha_only=False), 'Character must articulate.'
args.output.mkdir(parents=True, exist_ok=True)
atlas = Image.new('RGBA', (3840, 2880))
for i, frame in enumerate(frames):
    atlas.paste(frame, ((i % 8) * 480, (i // 8) * 480))
atlas.save(args.output / 'character-cycle.webp', quality=88, method=3, alpha_quality=100)
frames[0].save(args.output / 'character-poster.webp', quality=90, method=3, alpha_quality=100)
metadata = {'role': args.role, 'frames': 48, 'columns': 8, 'rows': 6, 'cellPixels': 480, 'durationMs': 1500,
            'renderer': 'Three.js 0.187.0; original Fleet24 partner meshes',
            'atlasBytes': (args.output / 'character-cycle.webp').stat().st_size}
(args.output / 'character-cycle.json').write_text(json.dumps(metadata, indent=2) + '\n')
if args.preview:
    args.preview.parent.mkdir(parents=True, exist_ok=True)
    previews = []
    for frame in frames:
        bg = Image.new('RGBA', frame.size, '#F3F7EE'); bg.alpha_composite(frame); previews.append(bg.convert('RGB'))
    previews[0].save(args.preview, save_all=True, append_images=previews[1:], duration=[31, 31, 31, 32] * 12, loop=0, quality=82, method=3)
print(json.dumps(metadata))
