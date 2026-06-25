package httpapi

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// SPAHandler serves static assets from the embedded build and falls back to
// index.html for client-side routes (so deep links like /s/<token> work).
func SPAHandler(dist fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if upath == "" {
			upath = "index.html"
		}

		// If the requested file exists in the bundle, serve it directly.
		if f, err := dist.Open(upath); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Otherwise it's a client route: serve index.html.
		r2 := r.Clone(r.Context())
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, r2)
	})
}
