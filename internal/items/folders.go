package items

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// gitkeep keeps an otherwise-empty folder present in git.
const gitkeep = ".gitkeep"

// Folders returns the sorted set of folder paths that exist on disk under items/.
func (s *Service) Folders() ([]string, error) {
	root := filepath.Join(s.dataDir, itemsRoot)
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	set := map[string]struct{}{}
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() || path == root {
			return err
		}
		rel := filepath.ToSlash(mustRel(root, path))
		set[rel] = struct{}{}
		return nil
	})
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(set))
	for f := range set {
		out = append(out, f)
	}
	sort.Strings(out)
	return out, nil
}

// CreateFolder makes an (initially empty) folder, kept alive with a .gitkeep.
func (s *Service) CreateFolder(path string) (string, error) {
	clean := cleanFolder(path)
	if clean == "" {
		return "", fmt.Errorf("empty folder name")
	}
	dir := filepath.Join(s.dataDir, itemsRoot, clean)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dir, gitkeep), nil, 0o644); err != nil {
		return "", err
	}
	s.changed()
	return clean, nil
}

// RenameFolder moves a folder (and everything in it) then re-indexes.
func (s *Service) RenameFolder(oldPath, newPath string) (string, error) {
	oldClean := cleanFolder(oldPath)
	newClean := cleanFolder(newPath)
	if oldClean == "" || newClean == "" {
		return "", fmt.Errorf("invalid folder name")
	}
	from := filepath.Join(s.dataDir, itemsRoot, oldClean)
	to := filepath.Join(s.dataDir, itemsRoot, newClean)
	if _, err := os.Stat(from); err != nil {
		return "", err
	}
	if _, err := os.Stat(to); err == nil {
		return "", fmt.Errorf("folder %q already exists", newClean)
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return "", err
	}
	if err := os.Rename(from, to); err != nil {
		return "", err
	}
	if err := s.Reconcile(); err != nil {
		return "", err
	}
	s.changed()
	return newClean, nil
}

// DeleteFolder removes a folder and all items inside it, then re-indexes so the
// removed items' rows are pruned.
func (s *Service) DeleteFolder(path string) error {
	clean := cleanFolder(path)
	if clean == "" {
		return fmt.Errorf("empty folder name")
	}
	dir := filepath.Join(s.dataDir, itemsRoot, clean)
	if !strings.HasPrefix(filepath.Clean(dir), filepath.Join(s.dataDir, itemsRoot)) {
		return fmt.Errorf("invalid folder path")
	}
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	if err := s.Reconcile(); err != nil {
		return err
	}
	s.changed()
	return nil
}
