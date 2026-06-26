package httpapi

import (
	"bytes"
	"html"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/phoenix911/scratchpad/internal/og"
)

// handleSharePage serves the SPA's index.html for /s/:token with Open Graph
// meta tags injected server-side, so link unfurls (Slack, iMessage, X, etc.)
// show a title + a funny SFW preview image. The SPA still boots and fetches the
// content client-side; crawlers just read the <head>.
func (s *Server) handleSharePage(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	title := "A scratch"
	if sh, err := s.st.GetShare(token); err == nil && time.Now().Unix() < sh.ExpiresAt {
		if fi, gErr := s.items.Get(sh.ItemID); gErr == nil {
			title = fi.Title
		}
	}

	indexHTML, err := s.readIndex()
	if err != nil {
		http.Error(w, "index unavailable", http.StatusInternalServerError)
		return
	}

	caption := og.CaptionFor(token)
	ogImage := s.absoluteBase() + "/og/" + token + ".png"
	pageURL := s.absoluteBase() + "/s/" + token

	meta := "" +
		`<meta property="og:type" content="website">` +
		`<meta property="og:title" content="` + html.EscapeString(title) + ` · scratchpad">` +
		`<meta property="og:description" content="` + html.EscapeString(caption) + `">` +
		`<meta property="og:image" content="` + html.EscapeString(ogImage) + `">` +
		`<meta property="og:image:width" content="1200">` +
		`<meta property="og:image:height" content="630">` +
		`<meta property="og:url" content="` + html.EscapeString(pageURL) + `">` +
		`<meta name="twitter:card" content="summary_large_image">` +
		`<meta name="twitter:title" content="` + html.EscapeString(title) + ` · scratchpad">` +
		`<meta name="twitter:description" content="` + html.EscapeString(caption) + `">` +
		`<meta name="twitter:image" content="` + html.EscapeString(ogImage) + `">`

	out := bytes.Replace(indexHTML, []byte("</head>"), []byte(meta+"</head>"), 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// Short cache so a fresh title propagates but crawlers can still fetch.
	w.Header().Set("Cache-Control", "public, max-age=60")
	_, _ = w.Write(out)
}

// handleOGImage renders the funny SFW preview PNG for a token.
func (s *Server) handleOGImage(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	title := "A scratch"
	if sh, err := s.st.GetShare(token); err == nil {
		if fi, gErr := s.items.Get(sh.ItemID); gErr == nil {
			title = fi.Title
		}
	}

	png, err := og.Card(title, token)
	if err != nil {
		http.Error(w, "image error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(png)
}

// readIndex returns the embedded SPA index.html.
func (s *Server) readIndex() ([]byte, error) {
	f, err := s.dist.Open("index.html")
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}

// absoluteBase returns the configured public base URL (with scheme), or "" so
// links fall back to relative paths when SHARE_BASE_URL isn't set.
func (s *Server) absoluteBase() string {
	base := s.cfg.ShareBaseURL
	if base == "" {
		return ""
	}
	if len(base) < 4 || (base[:4] != "http") {
		base = "https://" + base
	}
	return base
}
