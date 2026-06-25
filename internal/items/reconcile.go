package items

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"scratchpad/internal/store"
)

// Reconcile walks <dataDir>/items and makes the index match what's on disk.
// This runs on boot (after a git pull) so files created/edited/removed on
// another machine show up correctly. Filenames carry the id (slug-<id>.<ext>),
// which lets reconcile preserve item ids across machines.
func (s *Service) Reconcile() error {
	root := filepath.Join(s.dataDir, itemsRoot)
	if err := os.MkdirAll(root, 0o755); err != nil {
		return err
	}

	seen := map[string]struct{}{}

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		base := d.Name()
		if strings.HasPrefix(base, ".") {
			return nil // skip dotfiles (e.g. .gitkeep)
		}

		id, ok := idFromFilename(base)
		if !ok {
			return nil
		}
		rel := filepath.ToSlash(mustRel(s.dataDir, path))
		folder := folderFromRel(rel)
		ext := strings.TrimPrefix(filepath.Ext(base), ".")

		it := store.Item{
			ID:     id,
			Title:  titleFromFilename(base),
			Path:   rel,
			Folder: folder,
		}
		if ext == drawExt {
			it.Type = TypeDraw
		} else {
			it.Type = TypeCode
			it.Language = languageForExt(ext)
		}

		// Preserve timestamps from an existing row; otherwise use file mtime.
		if existing, gErr := s.st.GetItem(id); gErr == nil {
			it.CreatedAt = existing.CreatedAt
			it.Title = existing.Title // DB title is authoritative (slug loses case/spaces)
		} else {
			if info, sErr := d.Info(); sErr == nil {
				it.CreatedAt = info.ModTime().Unix()
			} else {
				it.CreatedAt = time.Now().Unix()
			}
		}
		if info, sErr := d.Info(); sErr == nil {
			it.UpdatedAt = info.ModTime().Unix()
		} else {
			it.UpdatedAt = time.Now().Unix()
		}

		seen[id] = struct{}{}
		return s.st.UpsertItem(it)
	})
	if err != nil {
		return err
	}

	// Prune index rows whose backing file is gone.
	known, err := s.st.AllItemIDs()
	if err != nil {
		return err
	}
	for id := range known {
		if _, ok := seen[id]; !ok {
			if dErr := s.st.DeleteItem(id); dErr != nil {
				return dErr
			}
		}
	}
	return nil
}

// idFromFilename extracts the id from "slug-<id>.<ext>". Ids are base32 (no
// padding), 8 chars for a 5-byte id.
func idFromFilename(base string) (string, bool) {
	name := strings.TrimSuffix(base, filepath.Ext(base))
	i := strings.LastIndex(name, "-")
	if i < 0 || i == len(name)-1 {
		return "", false
	}
	id := name[i+1:]
	if len(id) < 4 {
		return "", false
	}
	return id, true
}

// titleFromFilename recovers a readable title from the slug portion.
func titleFromFilename(base string) string {
	name := strings.TrimSuffix(base, filepath.Ext(base))
	if i := strings.LastIndex(name, "-"); i > 0 {
		name = name[:i]
	}
	name = strings.ReplaceAll(name, "-", " ")
	if name == "" {
		return "untitled"
	}
	return name
}

// folderFromRel returns the folder path between items/ and the filename.
func folderFromRel(rel string) string {
	rel = strings.TrimPrefix(rel, itemsRoot+"/")
	dir := filepath.ToSlash(filepath.Dir(rel))
	if dir == "." {
		return ""
	}
	return dir
}

func mustRel(base, target string) string {
	r, err := filepath.Rel(base, target)
	if err != nil {
		return target
	}
	return r
}
