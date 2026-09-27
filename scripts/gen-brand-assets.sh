#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# يولّد صور هوية التطبيق (الأيقونات + شعار شاشة البدء + صور بدء iOS)
# من صورة واحدة. يُشغَّل يدويًا عند الحاجة فقط:
#
#     npm run brand                          # من المصدر المحفوظ في المستودع
#     npm run brand -- path/to/full.png      # من صورة جديدة (تُقتطع وتُحفظ كمصدر)
#
# يحتاج ImageMagick (convert) — أداة تطوير فقط. النواتج محفوظة داخل المستودع،
# لذلك المعاينة والبناء والنشر لا تعتمد على هذا السكربت ولا على أي أداة خارجية.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SRC_FULL="${1:-}"
CROP="1100x1100+68+76"   # إطار البطاقة داخل الصورة الأصلية
BG="#0A2440"             # كحلي مطابق لشريط الصورة السفلي (خلفية شاشة البدء)
WORK=768                 # مقاس العمل الداخلي (يكفي لكل النواتج المطلوبة)
RADIUS_PCT=27            # استدارة زوايا البطاقة ≈ 27% من الضلع

command -v convert >/dev/null 2>&1 || { echo "ImageMagick (convert) غير متوفر — لا تغيير على الملفات الحالية."; exit 1; }

mkdir -p assets/brand public/brand public/icons .mythex/tmp/brand
TMP=.mythex/tmp/brand

# 0) إن مُرِّرت صورة جديدة: اقتطع البطاقة واحفظها كمصدر داخل المستودع
if [ -n "$SRC_FULL" ]; then
  [ -f "$SRC_FULL" ] || { echo "الصورة غير موجودة: $SRC_FULL"; exit 1; }
  convert "$SRC_FULL" -crop "$CROP" +repage -resize "${WORK}x${WORK}" -quality 92 -strip \
    assets/brand/app-icon-source.jpg
fi
SRC=assets/brand/app-icon-source.jpg
[ -f "$SRC" ] || { echo "مصدر الهوية غير موجود: $SRC"; exit 1; }

# 1) قناع الاستدارة: أيقونة زواياها شفافة
R=$(( WORK * RADIUS_PCT / 100 ))
convert "$SRC" \
  \( -size "${WORK}x${WORK}" xc:none -fill white \
     -draw "roundrectangle 0,0,$((WORK-1)),$((WORK-1)),${R},${R}" \) \
  -alpha off -compose CopyOpacity -composite -strip "$TMP/masked.png"

# 2) بلاطة الهوية: البطاقة على خلفية كحلية مسطّحة (لشاشة البدء وأيقونة النظام)
CARD=$(( WORK * 72 / 100 ))
convert -size "${WORK}x${WORK}" "xc:$BG" \
  \( "$TMP/masked.png" -resize "${CARD}x${CARD}" \
     \( +clone -background '#02101F' -shadow 60x11+0+9 \) +swap \
     -background none -layers merge +repage \) \
  -gravity center -composite -strip "$TMP/tile.png"

# 3) أيقونات PWA الشفافة (192 · 512) — مخفّفة بالpalette بلا فرق مرئي
convert "$TMP/masked.png" -resize 512x512 -strip -colors 256 \
  -define png:compression-level=9 public/icons/icon-512.png
convert "$TMP/masked.png" -resize 192x192 -strip -colors 256 \
  -define png:compression-level=9 public/icons/icon-192.png

# 4) أيقونة قابلة للقص (maskable) + أيقونة iOS
convert "$TMP/tile.png" -resize 512x512 -sampling-factor 4:2:0 -quality 88 -strip \
  public/icons/icon-512-maskable.jpg
convert "$TMP/tile.png" -resize 180x180 -strip -colors 256 \
  -define png:compression-level=9 public/icons/icon-180.png
cp public/icons/icon-180.png public/apple-touch-icon.png

# 5) favicon (16 · 32 · 48 داخل ملف واحد + نسخة 32 مستقلة)
for s in 16 32 48; do
  convert "$TMP/tile.png" -resize ${s}x${s} -strip "$TMP/fav-$s.png"
done
convert "$TMP/fav-16.png" "$TMP/fav-32.png" "$TMP/fav-48.png" public/favicon.ico
cp "$TMP/fav-32.png" public/favicon-32.png

# 6) شعار شاشة البدء: خلفيته بنفس لون الشاشة فيندمج حدّه بلا خطوط فاصلة
convert "$TMP/tile.png" -resize 512x512 -sampling-factor 4:2:0 -quality 86 -strip \
  public/brand/splash-logo.jpg

# 7) صور بدء iOS (كل جهاز ينزّل الصورة المطابقة له فقط)
for size in 1290x2796 1179x2556 1284x2778 1170x2532 1125x2436 1242x2688 828x1792 750x1334 2048x2732 1668x2388; do
  W="${size%x*}"; H="${size#*x}"
  LOGO=$(( W * 62 / 100 )); MAXH=$(( H * 20 / 100 ))
  [ "$LOGO" -gt "$MAXH" ] && LOGO="$MAXH"
  convert -size "$size" "xc:$BG" \
    \( "$TMP/tile.png" -resize "${LOGO}x${LOGO}" \) \
    -gravity center -geometry +0-$(( H / 40 )) -composite \
    -sampling-factor 4:2:0 -quality 82 -strip "public/brand/startup-${W}x${H}.jpg"
done

rm -rf "$TMP"
echo "تم توليد صور الهوية: أيقونات + شعار شاشة البدء + صور بدء iOS."
