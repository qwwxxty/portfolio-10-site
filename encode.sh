#!/usr/bin/env bash
# =========================================================
# Емаль — кодування відео для слотів сайту (див. VIDEOS.md)
#
#   ./encode.sh hero   вихідник.mov     → assets/video/hero.mp4 + hero.webm
#   ./encode.sh crown  вихідник.mov     → assets/video/crown-scrub.mp4 + .webm  (ключовий кадр на КОЖНОМУ кадрі)
#   ./encode.sh cardA  вихідник.mov     → assets/video/card-microscope.mp4 + .webm
#   ./encode.sh cardB  вихідник.mov     → assets/video/card-kids.mp4 + .webm
#
# Що робить: без звуку, H.264 (MP4) + VP9 (WebM), не більше 1080p,
# двопрохідне кодування з бітрейтом під ліміт розміру (за замовчуванням 3.8 МБ,
# тобто менше 4 МБ на файл). Ліміт можна змінити: MAX_MB=3 ./encode.sh hero in.mov
# Потрібен ffmpeg з libx264 і libvpx-vp9 (brew install ffmpeg / apt install ffmpeg).
# Після кодування увімкни слот у script.js: VIDEO.<слот>.on = true
# =========================================================
set -euo pipefail

OUT_DIR="${OUT_DIR:-assets/video}"
MAX_MB="${MAX_MB:-3.8}"

usage() {
  sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

[[ $# -eq 2 ]] || usage
SLOT="$1"
IN="$2"
[[ -f "$IN" ]] || { echo "Немає файлу: $IN" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "Потрібен ffmpeg" >&2; exit 1; }

FPS=25
SCRUB=0
MAX_SEC=12
case "$SLOT" in
  hero)
    # фон першої сцени: 16:9, до 1920×1080
    NAME="hero"
    VF="crop='min(iw,ih*16/9)':'min(ih,iw*9/16)',scale='min(1920,iw)':-2:flags=lanczos,crop=trunc(iw/2)*2:trunc(ih/2)*2,fps=$FPS,format=yuv420p"
    ;;
  crown)
    # відео за прокруткою: квадрат 720×720, ключовий кадр на кожному кадрі
    NAME="crown-scrub"
    VF="crop='min(iw,ih)':'min(iw,ih)',scale=720:720:flags=lanczos,fps=$FPS,format=yuv420p"
    SCRUB=1
    MAX_SEC=8
    ;;
  cardA|cardB)
    # скляні картки: вертикальні 4:5, 864×1080
    [[ "$SLOT" == "cardA" ]] && NAME="card-microscope" || NAME="card-kids"
    VF="crop='min(iw,ih*4/5)':'min(ih,iw*5/4)',scale=864:1080:flags=lanczos,fps=$FPS,format=yuv420p"
    MAX_SEC=8
    ;;
  *) usage ;;
esac

mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
cleanup() { [[ -n "${TMP:-}" && -d "$TMP" ]] && rm -r -- "$TMP"; }
trap cleanup EXIT

# Тривалість (обрізаємо до MAX_SEC — довше в циклі не потрібно)
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")"
DUR="$(awk -v d="$DUR" -v m="$MAX_SEC" 'BEGIN { if (d > m) d = m; printf "%.2f", d }')"

# Бітрейт під ліміт: МБ → кбіт/с, із запасом 8% на контейнер
KBPS="$(awk -v mb="$MAX_MB" -v d="$DUR" 'BEGIN { printf "%d", mb * 8 * 1024 / d * 0.92 }')"
echo "▸ $SLOT: $IN → $OUT_DIR/$NAME.{mp4,webm} · ${DUR} с · ${KBPS} кбіт/с"

X264_EXTRA=()
VP9_EXTRA=(-g $((FPS * 2)))
if [[ $SCRUB -eq 1 ]]; then
  # Кожен кадр — ключовий: інакше перемотування скролом смикається
  X264_EXTRA=(-x264-params "keyint=1:min-keyint=1:scenecut=0")
  VP9_EXTRA=(-g 1 -keyint_min 1)
fi

COMMON=(-hide_banner -loglevel error -y -t "$DUR" -i "$IN" -an -vf "$VF")
LIMIT=$((4 * 1024 * 1024))

enc_mp4() { # $1 — бітрейт, кбіт/с
  ffmpeg "${COMMON[@]}" -c:v libx264 -preset slow -profile:v high -b:v "${1}k" -maxrate "$(($1 * 3 / 2))k" -bufsize "$(($1 * 2))k" \
    "${X264_EXTRA[@]}" -pass 1 -passlogfile "$TMP/x264" -f mp4 /dev/null
  ffmpeg "${COMMON[@]}" -c:v libx264 -preset slow -profile:v high -b:v "${1}k" -maxrate "$(($1 * 3 / 2))k" -bufsize "$(($1 * 2))k" \
    "${X264_EXTRA[@]}" -pass 2 -passlogfile "$TMP/x264" -movflags +faststart "$OUT_DIR/$NAME.mp4"
}
enc_webm() {
  ffmpeg "${COMMON[@]}" -c:v libvpx-vp9 -b:v "${1}k" -row-mt 1 -deadline good -cpu-used 4 \
    "${VP9_EXTRA[@]}" -pass 1 -passlogfile "$TMP/vp9" -f webm /dev/null
  ffmpeg "${COMMON[@]}" -c:v libvpx-vp9 -b:v "${1}k" -row-mt 1 -deadline good -cpu-used 2 \
    "${VP9_EXTRA[@]}" -pass 2 -passlogfile "$TMP/vp9" "$OUT_DIR/$NAME.webm"
}

# Кодуємо; якщо файл усе одно більший за 4 МБ (буває з «кожен кадр ключовий») —
# повторюємо з бітрейтом на 25% меншим, до трьох спроб.
for KIND in mp4 webm; do
  RATE=$KBPS
  for TRY in 1 2 3 4; do
    "enc_$KIND" "$RATE"
    F="$OUT_DIR/$NAME.$KIND"
    SIZE=$(wc -c < "$F")
    (( SIZE <= LIMIT )) && break
    [[ $TRY -lt 4 ]] && { RATE=$((RATE * 3 / 4)); echo "  $KIND більший за 4 МБ, повтор із ${RATE} кбіт/с"; }
  done
  printf '  %-40s %6.2f МБ' "$F" "$(awk -v s="$SIZE" 'BEGIN { print s / 1048576 }')"
  if (( SIZE > LIMIT )); then echo "  ⚠ більше 4 МБ — скороти кліп або зменш MAX_MB"; else echo "  ✓"; fi
done

echo "Готово. Увімкни слот у script.js: VIDEO.$SLOT.on = true"
