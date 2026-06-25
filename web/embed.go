// Package web embeds the built React SPA so the whole app ships as one binary.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var distFS embed.FS

// Dist returns the built SPA rooted at dist/ (so paths are like index.html).
func Dist() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err) // dist is embedded at build time; this cannot fail in practice
	}
	return sub
}
