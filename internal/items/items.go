// Package items is the domain service for snippets and drawings. It owns the
// files under <dataDir>/items and keeps the store (SQLite index) in sync.
package items

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/phoenix911/scratchpad/internal/store"
)

// wikiLinkRe matches [[Title]] references used for backlinks.
var wikiLinkRe = regexp.MustCompile(`\[\[([^\[\]]+)\]\]`)

// extractLinks returns the de-duplicated [[Title]] targets in content.
func extractLinks(content string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, m := range wikiLinkRe.FindAllStringSubmatch(content, -1) {
		t := strings.TrimSpace(m[1])
		if t == "" {
			continue
		}
		key := strings.ToLower(t)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, t)
	}
	return out
}

const (
	TypeCode    = "code"
	TypeDraw    = "draw"
	TypeMind    = "mind"
	TypeDoc     = "doc"
	TypeKanban  = "kanban"
	TypeCornell = "cornell"

	drawExt    = "excalidraw"
	mindExt    = "mind"
	docExt     = "doc"
	kanbanExt  = "kanban"
	cornellExt = "cornell"
	itemsRoot  = "items"
	// archiveRoot and trashRoot mirror itemsRoot for archived and recycle-bin
	// items. Archiving/trashing moves a file from items/<folder>/… to
	// archive|trash/<folder>/…; the folder structure is kept so restoring puts
	// the file back in its original location.
	archiveRoot = "archive"
	trashRoot   = "trash"
)

func validType(t string) bool {
	switch t {
	case TypeCode, TypeDraw, TypeMind, TypeDoc, TypeKanban, TypeCornell:
		return true
	}
	return false
}

// ErrNotFound is re-exported so callers don't need the store package.
var ErrNotFound = store.ErrNotFound

// Service ties the filesystem (source of truth) to the store (index).
type Service struct {
	st      *store.Store
	dataDir string
	// onChange is called after any mutation so a higher layer can debounce a
	// git commit. May be nil.
	onChange func()
}

// New constructs the service. dataDir is the git working tree root; items live
// under dataDir/items.
func New(st *store.Store, dataDir string, onChange func()) *Service {
	return &Service{st: st, dataDir: dataDir, onChange: onChange}
}

// FullItem is an item's metadata plus its file content.
type FullItem struct {
	store.Item
	Content string `json:"content"`
}

// CreateInput describes a new item.
type CreateInput struct {
	Type     string
	Title    string
	Folder   string
	Language string
	Content  string
}

// Create writes the file and indexes it.
func (s *Service) Create(in CreateInput) (FullItem, error) {
	if !validType(in.Type) {
		return FullItem{}, fmt.Errorf("invalid type %q", in.Type)
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = "untitled"
	}
	now := time.Now().Unix()

	it := store.Item{
		ID:        newID(),
		Title:     title,
		Type:      in.Type,
		Folder:    cleanFolder(in.Folder),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if in.Type == TypeCode {
		it.Language = strings.ToLower(strings.TrimSpace(in.Language))
		if it.Language == "" {
			it.Language = "text"
		}
	}
	it.Path = s.relPath(it)

	if err := s.writeFile(it.Path, in.Content); err != nil {
		return FullItem{}, err
	}
	if err := s.st.UpsertItem(it); err != nil {
		_ = os.Remove(s.abs(it.Path))
		return FullItem{}, err
	}
	_ = s.st.SetLinks(it.ID, extractLinks(in.Content))
	s.changed()
	return FullItem{Item: it, Content: in.Content}, nil
}

// Get returns metadata + content.
func (s *Service) Get(id string) (FullItem, error) {
	it, err := s.st.GetItem(id)
	if err != nil {
		return FullItem{}, err
	}
	b, err := os.ReadFile(s.abs(it.Path))
	if err != nil {
		return FullItem{}, err
	}
	return FullItem{Item: it, Content: string(b)}, nil
}

// List returns all item metadata, newest first.
func (s *Service) List() ([]store.Item, error) { return s.st.ListItems() }

// UpdateInput carries optional changes; nil pointers mean "leave unchanged".
type UpdateInput struct {
	Title    *string
	Folder   *string
	Language *string
	Content  *string
}

// Update applies changes, moving the file if its derived path changed.
func (s *Service) Update(id string, in UpdateInput) (FullItem, error) {
	it, err := s.st.GetItem(id)
	if err != nil {
		return FullItem{}, err
	}
	oldPath := it.Path

	if in.Title != nil {
		t := strings.TrimSpace(*in.Title)
		if t != "" {
			it.Title = t
		}
	}
	if in.Folder != nil {
		it.Folder = cleanFolder(*in.Folder)
	}
	if in.Language != nil && it.Type == TypeCode {
		if l := strings.ToLower(strings.TrimSpace(*in.Language)); l != "" {
			it.Language = l
		}
	}
	it.UpdatedAt = time.Now().Unix()
	it.Path = s.relPath(it)

	// Move the file if the derived path changed (title/folder/language edits).
	if it.Path != oldPath {
		if err := os.MkdirAll(filepath.Dir(s.abs(it.Path)), 0o755); err != nil {
			return FullItem{}, err
		}
		if err := os.Rename(s.abs(oldPath), s.abs(it.Path)); err != nil && !os.IsNotExist(err) {
			return FullItem{}, err
		}
	}
	if in.Content != nil {
		if err := s.writeFile(it.Path, *in.Content); err != nil {
			return FullItem{}, err
		}
		_ = s.st.SetLinks(it.ID, extractLinks(*in.Content))
	}
	if err := s.st.UpsertItem(it); err != nil {
		return FullItem{}, err
	}
	s.changed()

	b, _ := os.ReadFile(s.abs(it.Path))
	return FullItem{Item: it, Content: string(b)}, nil
}

// Delete moves an item to the recycle bin (trash/) rather than removing it.
// Use Purge to delete permanently from there.
func (s *Service) Delete(id string) error {
	_, err := s.move(id, false, true)
	return err
}

// Archive moves an item to archive/ (archived=true) or back to items/
// (archived=false), preserving its folder. Archived items are hidden from the
// normal lists but kept on disk so the change is reversible and syncs to git.
func (s *Service) Archive(id string, archived bool) (store.Item, error) {
	return s.move(id, archived, false)
}

// Restore brings a trashed or archived item back to the active items/ tree.
func (s *Service) Restore(id string) (store.Item, error) {
	return s.move(id, false, false)
}

// Purge permanently removes an item's file and index row. Intended for items
// already in the recycle bin.
func (s *Service) Purge(id string) error {
	it, err := s.st.GetItem(id)
	if err != nil {
		return err
	}
	if err := os.Remove(s.abs(it.Path)); err != nil && !os.IsNotExist(err) {
		return err
	}
	if err := s.st.DeleteItem(id); err != nil {
		return err
	}
	s.changed()
	return nil
}

// move relocates an item between the items/, archive/ and trash/ roots to match
// the requested state, moving its file and updating the index.
func (s *Service) move(id string, archived, trashed bool) (store.Item, error) {
	it, err := s.st.GetItem(id)
	if err != nil {
		return store.Item{}, err
	}
	if it.Archived == archived && it.Trashed == trashed {
		return it, nil // already in the requested state
	}
	oldPath := it.Path
	it.Archived = archived
	it.Trashed = trashed
	it.Path = s.relPath(it)
	if it.Path != oldPath {
		if err := os.MkdirAll(filepath.Dir(s.abs(it.Path)), 0o755); err != nil {
			return store.Item{}, err
		}
		if err := os.Rename(s.abs(oldPath), s.abs(it.Path)); err != nil && !os.IsNotExist(err) {
			return store.Item{}, err
		}
		// Don't leave an empty source folder behind (e.g. after archiving the
		// last item in a folder) — it would still show in the sidebar tree.
		s.pruneEmptyParents(oldPath)
	}
	if err := s.st.UpsertItem(it); err != nil {
		return store.Item{}, err
	}
	s.changed()
	return it, nil
}

// pruneEmptyParents removes now-empty ancestor directories of a moved file, up
// to (but not including) the items/archive/trash root. os.Remove only deletes
// truly-empty dirs, so folders kept alive by a .gitkeep are preserved.
func (s *Service) pruneEmptyParents(rel string) {
	dir := filepath.Dir(rel)
	for {
		base := filepath.Base(dir)
		if dir == "." || base == itemsRoot || base == archiveRoot || base == trashRoot {
			return
		}
		if err := os.Remove(s.abs(dir)); err != nil {
			return // non-empty (or gone) — stop climbing
		}
		dir = filepath.Dir(dir)
	}
}

// pruneFolderDir drops the folder's directory under any root where it no longer
// holds item files (including a leftover .gitkeep), so an archived/trashed
// folder disappears from the tree instead of lingering empty.
func (s *Service) pruneFolderDir(folder string) {
	for _, root := range []string{itemsRoot, archiveRoot, trashRoot} {
		dir := filepath.Join(s.dataDir, root, folder)
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			continue
		}
		if !dirHasItemFiles(dir) {
			_ = os.RemoveAll(dir)
		}
	}
}

// dirHasItemFiles reports whether dir (recursively) contains any real item file.
func dirHasItemFiles(dir string) bool {
	found := false
	_ = filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if _, ok := idFromFilename(d.Name()); ok {
			found = true
			return fs.SkipAll
		}
		return nil
	})
	return found
}

// ArchiveFolder archives (archived=true) or restores (archived=false) every
// active item in a folder and its subfolders. Returns the number moved.
func (s *Service) ArchiveFolder(folder string, archived bool) (int, error) {
	return s.moveFolder(folder, func(it store.Item) (bool, bool, bool) {
		// Only touch active⇄archived; leave trashed items alone.
		if it.Trashed || it.Archived == archived {
			return false, false, false
		}
		return true, archived, false
	})
}

// TrashFolder moves every active/archived item in a folder (and its subfolders)
// to the recycle bin. Returns the number moved.
func (s *Service) TrashFolder(folder string) (int, error) {
	return s.moveFolder(folder, func(it store.Item) (bool, bool, bool) {
		if it.Trashed {
			return false, false, false
		}
		return true, false, true
	})
}

// moveFolder applies decide() to every item under folder (and subfolders).
// decide returns (move?, archived, trashed) for the matched item.
func (s *Service) moveFolder(folder string, decide func(store.Item) (bool, bool, bool)) (int, error) {
	clean := cleanFolder(folder)
	if clean == "" {
		return 0, fmt.Errorf("empty folder name")
	}
	list, err := s.st.ListItems()
	if err != nil {
		return 0, err
	}
	n := 0
	for _, it := range list {
		if it.Folder != clean && !strings.HasPrefix(it.Folder, clean+"/") {
			continue
		}
		ok, archived, trashed := decide(it)
		if !ok {
			continue
		}
		if _, err := s.move(it.ID, archived, trashed); err != nil {
			return n, err
		}
		n++
	}
	// Remove the emptied source folder dirs so the folder leaves the tree.
	s.pruneFolderDir(clean)
	return n, nil
}

// --- helpers ---

func (s *Service) abs(rel string) string { return filepath.Join(s.dataDir, rel) }

func (s *Service) relPath(it store.Item) string {
	ext := drawExt
	switch it.Type {
	case TypeCode:
		ext = extForLanguage(it.Language)
	case TypeMind:
		ext = mindExt
	case TypeDoc:
		ext = docExt
	case TypeKanban:
		ext = kanbanExt
	case TypeCornell:
		ext = cornellExt
	}
	name := fmt.Sprintf("%s-%s.%s", slug(it.Title), it.ID, ext)
	root := rootFor(it)
	if it.Folder == "" {
		return filepath.ToSlash(filepath.Join(root, name))
	}
	return filepath.ToSlash(filepath.Join(root, it.Folder, name))
}

// rootFor picks the on-disk root for an item by its state. Trashed wins over
// archived so an item is never in two places.
func rootFor(it store.Item) string {
	switch {
	case it.Trashed:
		return trashRoot
	case it.Archived:
		return archiveRoot
	default:
		return itemsRoot
	}
}

func (s *Service) writeFile(rel, content string) error {
	abs := s.abs(rel)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}

func (s *Service) changed() {
	if s.onChange != nil {
		s.onChange()
	}
}

// newID returns a short, URL-safe, lowercase id.
func newID() string {
	var b [5]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand failing is catastrophic; fall back to time-based entropy.
		t := time.Now().UnixNano()
		for i := range b {
			b[i] = byte(t >> (8 * i))
		}
	}
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b[:]))
}

// slug makes a filesystem-safe, readable slug from a title.
func slug(title string) string {
	var sb strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(title) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			sb.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && sb.Len() > 0 {
				sb.WriteByte('-')
				lastDash = true
			}
		}
	}
	out := strings.Trim(sb.String(), "-")
	if len(out) > 50 {
		out = strings.Trim(out[:50], "-")
	}
	if out == "" {
		return "untitled"
	}
	return out
}

// cleanFolder normalizes a folder path: no leading/trailing slashes, no "..".
func cleanFolder(folder string) string {
	folder = strings.Trim(strings.TrimSpace(folder), "/")
	if folder == "" {
		return ""
	}
	parts := strings.Split(folder, "/")
	clean := parts[:0]
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" || p == "." || p == ".." {
			continue
		}
		clean = append(clean, slug(p))
	}
	return strings.Join(clean, "/")
}
