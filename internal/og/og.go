// Package og renders Open Graph preview images for share links — a 1200x630
// PNG card with a random (but SFW) funny caption and the item's title. Uses Go's
// built-in fonts, so there are no external assets and it works in a static binary.
package og

import (
	"bytes"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	"image/png"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

const (
	width  = 1200
	height = 630
)

// Keep these light, harmless, developer-flavored, and strictly SFW.
var captions = []string{
	"certified napkin math",
	"this compiled in my head",
	"draft number infinity",
	"peak engineering, allegedly",
	"handle with care. or don't.",
	"you've been sent a scratch",
	"works on my machine",
	"a wild snippet appears",
	"do not perceive my variable names",
	"TODO: make this good",
	"the architecture, such as it is",
	"thoughts, but make them rectangles",
	"100% organic, free-range code",
	"ship it and find out",
}

var (
	bg      = color.RGBA{0x0f, 0x12, 0x18, 0xff}
	panel   = color.RGBA{0x16, 0x1a, 0x22, 0xff}
	ink     = color.RGBA{0xe9, 0xec, 0xf4, 0xff}
	inkSoft = color.RGBA{0x98, 0xa0, 0xb3, 0xff}
	dot     = color.RGBA{0x96, 0xaa, 0xdc, 0x16}
	accent  = color.RGBA{0x4d, 0x6d, 0xf5, 0xff}
)

var (
	faceTitle = mustFace(gobold.TTF, 70)
	faceWord  = mustFace(gobold.TTF, 34)
	faceBody  = mustFace(goregular.TTF, 34)
	faceSmall = mustFace(goregular.TTF, 24)
)

// CaptionFor returns the deterministic funny caption for a token, so a link's
// preview is stable across unfurls.
func CaptionFor(token string) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte(token))
	return captions[int(h.Sum32())%len(captions)]
}

// Card renders the PNG for a share link.
func Card(title, token string) ([]byte, error) {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), &image.Uniform{bg}, image.Point{}, draw.Src)

	// Faint grid dots — the scratchpad signature.
	for y := 24; y < height; y += 48 {
		for x := 24; x < width; x += 48 {
			img.Set(x, y, dot)
			img.Set(x+1, y, dot)
			img.Set(x, y+1, dot)
		}
	}

	// Inset panel + cobalt accent bar down the left edge.
	margin := 64
	drawRect(img, image.Rect(margin, margin, width-margin, height-margin), panel)
	drawRect(img, image.Rect(margin, margin, margin+8, height-margin), accent)

	x0 := margin + 56

	// Wordmark with a cobalt caret block.
	drawText(img, faceWord, x0, margin+90, ink, "scratchpad")
	wmWidth := textWidth(faceWord, "scratchpad")
	drawRect(img, image.Rect(x0+wmWidth+10, margin+66, x0+wmWidth+34, margin+96), accent)

	// Caption — the funny line, wrapped to the panel width.
	caption := CaptionFor(token)
	lines := wrap(faceTitle, caption, width-2*margin-120)
	y := 300
	for _, ln := range lines {
		drawText(img, faceTitle, x0, y, ink, ln)
		y += 86
	}

	// Title of the shared item.
	if title != "" {
		drawText(img, faceBody, x0, y+24, inkSoft, truncate(faceBody, title, width-2*margin-120))
	}

	// Footer note.
	drawText(img, faceSmall, x0, height-margin-40, inkSoft, "view-only link · scratchpad")

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// --- drawing helpers ---

func mustFace(ttf []byte, size float64) font.Face {
	f, err := opentype.Parse(ttf)
	if err != nil {
		panic(err)
	}
	face, err := opentype.NewFace(f, &opentype.FaceOptions{Size: size, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		panic(err)
	}
	return face
}

func drawRect(img *image.RGBA, r image.Rectangle, c color.Color) {
	draw.Draw(img, r, &image.Uniform{c}, image.Point{}, draw.Src)
}

func drawText(img *image.RGBA, face font.Face, x, y int, c color.Color, s string) {
	d := &font.Drawer{
		Dst:  img,
		Src:  &image.Uniform{c},
		Face: face,
		Dot:  fixed.P(x, y),
	}
	d.DrawString(s)
}

func textWidth(face font.Face, s string) int {
	return font.MeasureString(face, s).Round()
}

func wrap(face font.Face, s string, maxWidth int) []string {
	words := splitWords(s)
	var lines []string
	cur := ""
	for _, w := range words {
		try := w
		if cur != "" {
			try = cur + " " + w
		}
		if textWidth(face, try) > maxWidth && cur != "" {
			lines = append(lines, cur)
			cur = w
		} else {
			cur = try
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	if len(lines) == 0 {
		lines = []string{s}
	}
	return lines
}

func truncate(face font.Face, s string, maxWidth int) string {
	if textWidth(face, s) <= maxWidth {
		return s
	}
	for len(s) > 1 {
		s = s[:len(s)-1]
		if textWidth(face, s+"…") <= maxWidth {
			return s + "…"
		}
	}
	return s
}

func splitWords(s string) []string {
	var out []string
	cur := ""
	for _, r := range s {
		if r == ' ' {
			if cur != "" {
				out = append(out, cur)
				cur = ""
			}
		} else {
			cur += string(r)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}
