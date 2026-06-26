// Package items is the domain service for snippets and drawings. It owns the
// files under <dataDir>/items and keeps the store (SQLite index) in sync.
package items

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"scratchpad/internal/store"
)

const (
	TypeCode   = "code"
	TypeDraw   = "draw"
	TypeMind   = "mind"
	TypeDoc    = "doc"
	TypeKanban = "kanban"

	drawExt   = "excalidraw"
	mindExt   = "mind"
	docExt    = "doc"
	kanbanExt = "kanban"
	itemsRoot = "items"
)

func validType(t string) bool {
	switch t {
	case TypeCode, TypeDraw, TypeMind, TypeDoc, TypeKanban:
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
	}
	if err := s.st.UpsertItem(it); err != nil {
		return FullItem{}, err
	}
	s.changed()

	b, _ := os.ReadFile(s.abs(it.Path))
	return FullItem{Item: it, Content: string(b)}, nil
}

// Delete removes the file and index row.
func (s *Service) Delete(id string) error {
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
	}
	name := fmt.Sprintf("%s-%s.%s", slug(it.Title), it.ID, ext)
	if it.Folder == "" {
		return filepath.ToSlash(filepath.Join(itemsRoot, name))
	}
	return filepath.ToSlash(filepath.Join(itemsRoot, it.Folder, name))
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
