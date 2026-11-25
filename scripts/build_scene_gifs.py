#!/usr/bin/env python3
"""Build 3 storyboard GIFs per Archive story for GitHub Pages.

These are CINEMATIC MOTION GRAPHICS, not AI-generated video. Existing media is
preserved; 3 independently animated passages are provisioned for every story.
Swap any scene media_url with a licensed AI-produced GIF or MP4 later.
"""
from __future__ import annotations
import json, math, random, re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

W, H = 324, 448
FRAME_COUNT = 12
FRAME_MS = 120
VERSION = "9.2"
LABELS = [
    ("intro", "01 · НАЧАЛО", "Первое свидетельство / место происшествия"),
    ("encounter", "02 · СЕРЕДИНА", "Присутствие замечено / опасность приближается"),
    ("finale", "03 · КОНЕЦ", "Развязка / последняя запись"),
]

def fit_photo(src: Path) -> Image.Image:
    with Image.open(src) as pic:
        pic = ImageOps.exif_transpose(pic)
        return ImageOps.fit(pic.convert("RGB"), (W, H), method=Image.Resampling.LANCZOS, centering=(0.5,0.42))

def add_scanlines(img: Image.Image, seed: int, t: int, stage: str) -> Image.Image:
    rng=random.Random(seed*3211 + t*197)
    overlay=Image.new("RGBA", (W,H), (0,0,0,0))
    d=ImageDraw.Draw(overlay,"RGBA")
    for y in range(t%3,H,4):
        d.line((0,y,W,y),fill=(3,7,8,26),width=1)
    for i in range(20):
        x=rng.randrange(W);y=rng.randrange(H)
        d.point((x,y),fill=(240,240,225,rng.randrange(30,115)))
    if t in (3,9):
        y=rng.randrange(45,H-45)
        d.rectangle((0,y,W,y+2),fill=(175,229,203,22))
    if stage=="finale" and t in (2,7):
        y=70+(seed*31+t*23)%(H-100)
        d.rectangle((0,y,W,y+6),fill=(175,40,38,88))
    return Image.alpha_composite(img.convert("RGBA"), overlay)

def animated_fog(canvas: Image.Image, stage: str, seed: int, t: int):
    overlay=Image.new("RGBA",(W,H),(0,0,0,0))
    d=ImageDraw.Draw(overlay,"RGBA")
    for i in range(5):
        x=int(-110+((t*(7+i*2)+seed*(i+3)*13+i*106)%(W+250)))
        y=90+i*92+int(9*math.sin((t+i*2)*math.pi/6))
        radius=60+(i%3)*20
        d.ellipse((x-radius*2,y-radius,x+radius*2,y+radius),
                  fill=(99,141,134,13+(i%2)*6))
    overlay=overlay.filter(ImageFilter.GaussianBlur(radius=34))
    canvas.alpha_composite(overlay)

def looming_shadow(canvas:Image.Image,seed:int,t:int):
    """Animated foreground silhouette: arms, head and body change each frame."""
    layer=Image.new("RGBA",(W,H))
    d=ImageDraw.Draw(layer,"RGBA")
    pulse=math.sin(t*math.pi/6)
    x=int(W*(0.45+(seed%5)*.027)+pulse*13)
    y=int(H*.48+4*math.cos(t*math.pi/6))
    size=0.83+(seed%4)*.08
    head=int(18*size)
    color=(2,5,9,213)
    # Long vertical silhouette with independently moving limbs and head.
    d.ellipse((x-head,y-95,x+head,y-95+head*2),fill=color)
    d.polygon([(x-17,y-55),(x+18,y-55),(x+28,y+49),(x-24,y+50)],fill=color)
    d.line([(x-15,y-41),(x-38-int(8*pulse),y+16),(x-45-int(18*pulse),y+47)],
           fill=color,width=15)
    d.line([(x+15,y-41),(x+43+int(14*pulse),y-8),(x+64+int(16*pulse),y-30)],
           fill=color,width=14)
    d.line([(x-12,y+40),(x-15-int(7*pulse),y+112)],
           fill=color,width=15)
    d.line([(x+13,y+40),(x+18+int(10*pulse),y+113)],
           fill=color,width=16)
    # Unnatural blinking eyes; true motion in the foreground, not panning.
    eye_alpha=145 if t not in (5,6) else 15
    d.ellipse((x-9,y-84,x-4,y-80),fill=(206,232,210,eye_alpha))
    d.ellipse((x+4,y-84,x+9,y-80),fill=(206,232,210,eye_alpha))
    shadow=layer.filter(ImageFilter.GaussianBlur(9))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(layer)

def final_creature(canvas:Image.Image,seed:int,t:int):
    rng=random.Random(seed*37+t*13)
    progress=(1-math.cos(t*math.pi/6))*.5
    layer=Image.new("RGBA",(W,H))
    d=ImageDraw.Draw(layer,"RGBA")
    if seed%3==0:
        # Face emerges from the lower darkness, jaw opens and eyes blink.
        cx=int(W*.52+18*math.sin(t*math.pi/6))
        cy=int(H*.70-35*progress)
        r=int(55+12*progress)
        d.ellipse((cx-r,cy-r*1.5,cx+r,cy+r*1.4),fill=(6,4,8,246))
        gap=int(10+22*progress)
        d.ellipse((cx-16,cy+13,cx+16,cy+13+gap),fill=(95,10,15,250))
        for eye_x in (cx-22,cx+22):
            d.ellipse((eye_x-5,cy-30,eye_x+5,cy-20),fill=(204,225,189,220))
    elif seed%3==1:
        # Unnaturally long claw reaches into frame, fingers independently flex.
        tx=int(W+40-235*progress)
        ty=int(H*.62+16*math.sin(t*math.pi/6))
        d.line([(W+90,H+40),(tx+80,ty+90),(tx+10,ty+25)],
               fill=(5,5,8,246),width=56,joint="curve")
        for i in range(5):
            dy=(i-2)*18
            reach=int((68+24*math.sin((t+i)*math.pi/6))*progress)
            d.line([(tx+10,ty+25),(tx-35-reach,ty+dy+3*math.sin((i+t)*math.pi/6))],
                   fill=(12,10,13,254),width=max(7,18-i))
    else:
        # Distorted horned silhouette slowly emerges from the center.
        cx=int(W*.50 + 7*math.sin(t*math.pi/6))
        cy=int(H*.62-48*progress)
        d.ellipse((cx-45,cy-76,cx+45,cy+53),fill=(5,6,10,248))
        d.polygon([(cx-45,cy-42),(cx-85,cy-155),(cx-13,cy-76)],fill=(5,6,10,248))
        d.polygon([(cx+45,cy-42),(cx+85,cy-155),(cx+13,cy-76)],fill=(5,6,10,248))
        for ex in (cx-19,cx+19):
            d.ellipse((ex-6,cy-26,ex+6,cy-14),fill=(201,55,35,245))
        d.ellipse((cx-20,cy+12,cx+20,cy+25+int(20*progress)),fill=(15,3,6,255))
    glow=layer.filter(ImageFilter.GaussianBlur(radius=17))
    canvas.alpha_composite(glow)
    canvas.alpha_composite(layer)
    # Tiny drifting shreds of red, independent of the underlying photo.
    dd=ImageDraw.Draw(canvas,"RGBA")
    for _ in range(10):
        x=rng.randrange(W); y=rng.randrange(H)
        dd.line((x,y,x+rng.randrange(-8,8),y+rng.randrange(8,35)),
                fill=(227,48,37,rng.randrange(45,120)),width=1)

def draw_frame(base:Image.Image,stage:str,seed:int,t:int)->Image.Image:
    wave=math.sin((t/FRAME_COUNT)*2*math.pi)
    brightness=(.71 if stage=="intro" else .62 if stage=="encounter" else .48)+.07*wave
    out=ImageEnhance.Brightness(base).enhance(brightness).convert("RGBA")
    grade=Image.new("RGBA",(W,H),(5,21,24,65) if stage!="finale" else (44,3,10,80))
    out.alpha_composite(grade)
    animated_fog(out,stage,seed,t)
    if stage=="intro":
        # Eerie light, delayed eyes and subtle moving foreground leaves.
        d=ImageDraw.Draw(out,"RGBA")
        x=int(W*.47+28*math.sin((t/FRAME_COUNT)*2*math.pi))
        y=int(H*.55)
        if t in (1,2,7,8):
            d.ellipse((x-12,y,x-7,y+5),fill=(208,232,218,120))
            d.ellipse((x+7,y,x+12,y+5),fill=(208,232,218,120))
    elif stage=="encounter":
        looming_shadow(out,seed,t)
    else:
        final_creature(out,seed,t)
    out=add_scanlines(out,seed,t,stage)
    # Authentic analogue-camera frame and quiet corner timestamp.
    d=ImageDraw.Draw(out,"RGBA")
    d.rectangle((8,8,W-9,H-9),outline=(192,222,206,57),width=1)
    d.text((15,15),"REC  ●  "+("CAM 01" if stage=="intro" else "CAM 02" if stage=="encounter" else "CAM 03"),
           fill=(215,226,212,180))
    d.text((15,H-25),f"ARCHIVE  /  {seed:04d}  /  {stage.upper()}",
           fill=(210,223,216,180))
    return out.convert("RGB")

def build_gif(src:Path,dst:Path,stage:str,seed:int):
    base=fit_photo(src)
    dst.parent.mkdir(parents=True,exist_ok=True)
    frames=[]
    for t in range(FRAME_COUNT):
        rgb=draw_frame(base,stage,seed,t)
        frames.append(rgb.quantize(colors=48,method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE))
    frames[0].save(dst,save_all=True,append_images=frames[1:],
                   loop=0,duration=FRAME_MS,disposal=2,optimize=True)
    with Image.open(dst) as test:
        if not test.is_animated or test.n_frames<6:raise RuntimeError(f"Not an animated GIF: {dst}")

def main(public:Path):
    catalog=public/"data"/"stories.json"
    data=json.loads(catalog.read_text(encoding="utf-8"))
    items=data["items"]
    if len(items)!=22:raise RuntimeError("Expected the original 22 stories")
    out=public/"media"/"animated-scenes"
    manifest=[]
    for item in items:
        sid=int(item["id"])
        orig=[s for s in item.get("scenes",[]) if isinstance(s,dict)]
        parts=[p for p in re.split(r"\n\s*\n",item.get("body","")) if p.strip()]
        if len(parts)<3:raise RuntimeError(f"Too few paragraphs for story {sid}")
        cover=public/item["media_url"]
        if not cover.is_file():raise FileNotFoundError(cover)
        scenes=[]
        positions=[0,max(1,len(parts)//2),len(parts)-1]
        for (key,title,description),pos in zip(LABELS,positions):
            existing=next((s for s in orig if s.get("id")==key),None)
            source=public/existing["media_url"] if existing and existing.get("media_url") else cover
            if not source.is_file():source=cover
            # Preserve the one genuine existing finale GIF as a real original animation.
            if key=="finale" and sid==3 and source.suffix.lower()==".gif":
                target=source
                relative=source.relative_to(public).as_posix()
            else:
                target=out/f"story_{sid:02d}_{key}.gif"
                build_gif(source,target,key,sid)
                relative=target.relative_to(public).as_posix()
            scene={"id":key,"title":title,"description":description,
                   "before_paragraph":pos,"type":"gif","media_url":relative,
                   "generation":"original-gif" if sid==3 and key=="finale" else "cinematic-motion-graphic"}
            scenes.append(scene)
            manifest.append({"story_id":sid,"story":item["title"],"scene":key,
                "narrative_excerpt":parts[pos][:270],"media":relative,
                "source":str(source.relative_to(public)),"generation":scene["generation"]})
        item["scenes"]=scenes
        print(f"story {sid:02d} · {item['title']}: 3 GIF scenes")
    catalog.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    (public/"data"/"scene-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    missing=[s["media"] for s in manifest if not (public/s["media"]).is_file()]
    if missing:raise RuntimeError(f"Missing scenes: {missing}")
    unique=set(s["media"] for s in manifest)
    assert len(manifest)==66 and len(unique)==66
    total=sum((public/path).stat().st_size for path in unique)
    print(f"VERIFIED: {len(manifest)} scene slots; {len(unique)} valid animated GIFs; {total/1048576:.1f} MiB")
    print("IMPORTANT: procedural motion graphics are NOT equivalent to AI video.")
if __name__=="__main__":
    main(Path(sys.argv[1] if len(sys.argv)>1 else "public"))
