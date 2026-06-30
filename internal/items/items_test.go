package items

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/phoenix911/scratchpad/internal/store"
)

func newSvc(t *testing.T) (*Service, string) {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	return New(st, filepath.Join(dir, "data"), nil), dir
}

func TestCreateGetUpdateDelete(t *testing.T) {
	svc, dir := newSvc(t)

	// Create a code snippet.
	fi, err := svc.Create(CreateInput{Type: TypeCode, Title: "Hello World", Language: "python", Content: "print('hi')"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if fi.Language != "python" {
		t.Errorf("language = %q, want python", fi.Language)
	}
	wantPath := filepath.Join(dir, "data", "items", "hello-world-"+fi.ID+".py")
	if _, err := os.Stat(wantPath); err != nil {
		t.Errorf("expected file at %s: %v", wantPath, err)
	}

	// Get it back.
	got, err := svc.Get(fi.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Content != "print('hi')" {
		t.Errorf("content = %q", got.Content)
	}

	// Update content + move via folder change.
	folder := "snippets"
	content := "print('bye')"
	up, err := svc.Update(fi.ID, UpdateInput{Folder: &folder, Content: &content})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	movedPath := filepath.Join(dir, "data", up.Path)
	if b, _ := os.ReadFile(movedPath); string(b) != content {
		t.Errorf("moved file content = %q", string(b))
	}
	if _, err := os.Stat(wantPath); !os.IsNotExist(err) {
		t.Errorf("old file should be gone")
	}

	// Delete moves the item to the recycle bin (trash/) — still indexed, but
	// flagged trashed and relocated on disk.
	if err := svc.Delete(fi.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	trashed, err := svc.Get(fi.ID)
	if err != nil {
		t.Fatalf("get after delete: %v", err)
	}
	if !trashed.Trashed {
		t.Errorf("item should be trashed after delete")
	}
	if _, err := os.Stat(filepath.Join(dir, "data", "trash", trashed.Folder, filepath.Base(trashed.Path))); err != nil {
		t.Errorf("expected file in trash/: %v", err)
	}

	// Restore brings it back to the active items/ tree.
	if _, err := svc.Restore(fi.ID); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if r, _ := svc.Get(fi.ID); r.Trashed {
		t.Errorf("item should be active after restore")
	}

	// Purge permanently removes it.
	if err := svc.Purge(fi.ID); err != nil {
		t.Fatalf("purge: %v", err)
	}
	if _, err := svc.Get(fi.ID); err != ErrNotFound {
		t.Errorf("get after purge = %v, want ErrNotFound", err)
	}
}

func TestArchiveAndTrashRoundTrip(t *testing.T) {
	svc, dir := newSvc(t)
	fi, err := svc.Create(CreateInput{Type: TypeCode, Title: "Note", Language: "text", Content: "x"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// Archive → file under archive/, flagged archived.
	if _, err := svc.Archive(fi.ID, true); err != nil {
		t.Fatalf("archive: %v", err)
	}
	a, _ := svc.Get(fi.ID)
	if !a.Archived || a.Trashed {
		t.Errorf("archived state wrong: %+v", a)
	}
	if _, err := os.Stat(filepath.Join(dir, "data", a.Path)); err != nil || filepath.Dir(a.Path) != "archive" {
		t.Errorf("archived file path = %q (err %v)", a.Path, err)
	}

	// A fresh reconcile (new DB) must recover the archived flag from disk.
	st2, _ := store.Open(filepath.Join(dir, "fresh.db"))
	defer st2.Close()
	svc2 := New(st2, filepath.Join(dir, "data"), nil)
	if err := svc2.Reconcile(); err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if r, _ := svc2.Get(fi.ID); !r.Archived {
		t.Errorf("archived flag lost across reconcile")
	}
}

func TestDrawingAndReconcile(t *testing.T) {
	svc, dir := newSvc(t)

	scene := `{"type":"excalidraw","version":2,"elements":[]}`
	fi, err := svc.Create(CreateInput{Type: TypeDraw, Title: "My Diagram", Content: scene})
	if err != nil {
		t.Fatalf("create draw: %v", err)
	}
	if filepath.Ext(fi.Path) != ".excalidraw" {
		t.Errorf("draw ext = %s", filepath.Ext(fi.Path))
	}

	// Simulate a fresh boot against the same data dir + a NEW db (as if pulled
	// from git): reconcile should rebuild the index from files alone.
	st2, err := store.Open(filepath.Join(dir, "fresh.db"))
	if err != nil {
		t.Fatalf("open fresh: %v", err)
	}
	defer st2.Close()
	svc2 := New(st2, filepath.Join(dir, "data"), nil)
	if err := svc2.Reconcile(); err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	got, err := svc2.Get(fi.ID)
	if err != nil {
		t.Fatalf("get after reconcile: %v", err)
	}
	if got.Type != TypeDraw || got.Content != scene {
		t.Errorf("reconciled item mismatch: type=%s", got.Type)
	}

	// Removing the file then reconciling should prune the row.
	os.Remove(filepath.Join(dir, "data", fi.Path))
	if err := svc2.Reconcile(); err != nil {
		t.Fatalf("reconcile 2: %v", err)
	}
	if _, err := svc2.Get(fi.ID); err != ErrNotFound {
		t.Errorf("pruned get = %v, want ErrNotFound", err)
	}
}
