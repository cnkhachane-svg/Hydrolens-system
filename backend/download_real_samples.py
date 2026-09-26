import os
import urllib.request

OUT_DIR = os.path.join("training", "dataset", "images", "test")
os.makedirs(OUT_DIR, exist_ok=True)

# Curated high-res microscopic water filter & particulate captures
SAMPLES = {
    "water_sample_01.jpg": "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1024&q=80",
    "water_sample_02.jpg": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1024&q=80",
    "water_sample_03.jpg": "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1024&q=80",
}

headers = {'User-Agent': 'Mozilla/5.0'}

print("[HydroLens] Downloading real microscope sample slides...")
for filename, url in SAMPLES.items():
    dest = os.path.join(OUT_DIR, filename)
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(dest, 'wb') as f:
            f.write(resp.read())
        print(f"  ✓ Saved {filename}")
    except Exception as e:
        print(f"  ✗ Failed {filename}: {e}")

print("Done. Images saved to training/dataset/images/test")