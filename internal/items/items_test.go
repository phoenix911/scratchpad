package items

import (
	"os"
	"path/filepath"
	"testing"

	"scratchpad/internal/store"
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

	// Delete.
	if err := svc.Delete(fi.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.Get(fi.ID); err != ErrNotFound {
		t.Errorf("get after delete = %v, want ErrNotFound", err)
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
