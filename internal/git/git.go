// Package git syncs the data directory to a remote repository by shelling out
// to the system `git` binary. This reuses the machine's existing git/SSH config
// (agent, keys, known_hosts, ~/.gitconfig), so SSH auth needs no extra setup.
// Commits are debounced so bursts of edits coalesce into one push.
package git

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	appcfg "github.com/phoenix911/scratchpad/internal/config"
)

const (
	debounce  = 5 * time.Second
	gitOpTime = 60 * time.Second
)

// Status reflects the current sync state for the UI.
type Status struct {
	Enabled  bool   `json:"enabled"`
	State    string `json:"state"` // off | idle | syncing | conflict | error
	LastSync int64  `json:"lastSync"`
	Message  string `json:"message"`
}

// Syncer owns git operations for the data dir. All git work is serialized by mu.
type Syncer struct {
	dir         string
	url         string
	authorName  string
	authorEmail string
	enabled     bool

	mu       sync.Mutex
	state    string
	lastSync int64
	message  string

	timerMu sync.Mutex
	timer   *time.Timer
}

// New builds a Syncer from config. If sync isn't configured, or `git` isn't on
// PATH, it returns a disabled no-op syncer (every method is safe to call).
func New(cfg appcfg.Config) (*Syncer, error) {
	s := &Syncer{
		dir:         cfg.DataDir,
		url:         cfg.GitURL,
		authorName:  cfg.GitAuthorName,
		authorEmail: cfg.GitAuthorEmail,
		state:       "off",
	}
	if !cfg.SyncEnabled() {
		return s, nil
	}
	if _, err := exec.LookPath("git"); err != nil {
		s.state, s.message = "error", "git not found on PATH"
		return s, nil
	}
	s.enabled = true
	s.state = "idle"
	return s, nil
}

// Status returns a snapshot for the /api/sync/status endpoint.
func (s *Syncer) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return Status{Enabled: s.enabled, State: s.state, LastSync: s.lastSync, Message: s.message}
}

func (s *Syncer) setState(state, msg string) {
	s.mu.Lock()
	s.state, s.message = state, msg
	if state == "idle" {
		s.lastSync = time.Now().Unix()
	}
	s.mu.Unlock()
}

// git runs a git command in the data dir and returns combined output.
func (s *Syncer) git(args ...string) (string, error) {
	ctx, cancel := contextTimeout(gitOpTime)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", s.dir}, args...)...)
	// Never prompt interactively — fail fast instead of hanging on credentials.
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	if err != nil {
		return out.String(), fmt.Errorf("git %s: %v: %s", strings.Join(args, " "), err, strings.TrimSpace(out.String()))
	}
	return out.String(), nil
}

// EnsureRepo makes the data dir a git repo wired to the remote. It clones an
// existing remote when the dir is empty (this also handles an empty remote),
// otherwise it initializes a repo and adds the remote.
func (s *Syncer) EnsureRepo() error {
	if !s.enabled {
		return nil
	}
	if isRepo(s.dir) {
		return s.ensureRemote()
	}
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	if dirEmpty(s.dir) {
		// `git clone` into an empty dir; succeeds (with a warning) for empty remotes.
		if _, err := runGit(s.dir, "clone", s.url, "."); err != nil {
			return err
		}
	} else {
		if _, err := s.git("init", "-b", "main"); err != nil {
			return err
		}
		if _, err := s.git("remote", "add", "origin", s.url); err != nil {
			return err
		}
		_, _ = s.git("fetch", "origin") // best-effort; remote may be empty
	}
	return s.configureIdentity()
}

func (s *Syncer) ensureRemote() error {
	if out, _ := s.git("remote"); strings.Contains(out, "origin") {
		_, _ = s.git("remote", "set-url", "origin", s.url)
	} else {
		if _, err := s.git("remote", "add", "origin", s.url); err != nil {
			return err
		}
	}
	return s.configureIdentity()
}

// configureIdentity sets a local commit identity so commits succeed even with no
// global ~/.gitconfig on the deploy box.
func (s *Syncer) configureIdentity() error {
	name := s.authorName
	if name == "" {
		name = "scratchpad"
	}
	email := s.authorEmail
	if email == "" {
		email = "scratchpad@local"
	}
	if _, err := s.git("config", "user.name", name); err != nil {
		return err
	}
	_, err := s.git("config", "user.email", email)
	return err
}

// Pull fast-forwards from the remote. Missing/empty upstreams are ignored; a
// divergence is surfaced as a conflict.
func (s *Syncer) Pull() error {
	if !s.enabled {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	branch := s.currentBranch()
	if _, err := s.git("fetch", "origin"); err != nil {
		// A brand-new/empty remote can't be fetched yet — not fatal.
		return nil
	}
	out, err := s.git("merge", "--ff-only", "origin/"+branch)
	if err != nil {
		if strings.Contains(out, "not something we can merge") ||
			strings.Contains(out, "unknown revision") {
			return nil // remote branch doesn't exist yet
		}
		if strings.Contains(out, "Not possible to fast-forward") || strings.Contains(out, "diverge") {
			s.state, s.message = "conflict", "remote has diverged — resolve before syncing"
			return fmt.Errorf("non-fast-forward")
		}
		return err
	}
	return nil
}

// Schedule debounces a commit+push after the latest edit (coalescing bursts).
func (s *Syncer) Schedule() {
	if !s.enabled {
		return
	}
	s.timerMu.Lock()
	defer s.timerMu.Unlock()
	if s.timer != nil {
		s.timer.Stop()
	}
	s.timer = time.AfterFunc(debounce, func() {
		if err := s.commitAndPush("update scratchpad"); err != nil {
			s.setState("error", err.Error())
		}
	})
}

// SyncNow performs an immediate pull + commit + push (the "Sync now" button).
func (s *Syncer) SyncNow() error {
	if !s.enabled {
		return nil
	}
	if err := s.Pull(); err != nil {
		s.setState("error", err.Error())
		return err
	}
	return s.commitAndPush("manual sync")
}

func (s *Syncer) commitAndPush(msg string) error {
	if !s.enabled {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = "syncing"

	if _, err := s.git("add", "-A"); err != nil {
		return err
	}
	if status, _ := s.git("status", "--porcelain"); strings.TrimSpace(status) != "" {
		if _, err := s.git("commit", "-m", msg); err != nil {
			return err
		}
	}
	if _, err := s.git("push", "-u", "origin", "HEAD"); err != nil {
		s.state, s.message = "error", err.Error()
		return err
	}
	s.state, s.message, s.lastSync = "idle", "", time.Now().Unix()
	return nil
}

// currentBranch returns the checked-out branch, defaulting to main.
func (s *Syncer) currentBranch() string {
	out, err := s.git("rev-parse", "--abbrev-ref", "HEAD")
	b := strings.TrimSpace(out)
	if err != nil || b == "" || b == "HEAD" {
		return "main"
	}
	return b
}

// --- small helpers ---

func isRepo(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, ".git"))
	return err == nil
}

func dirEmpty(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return true
	}
	return len(entries) == 0
}

func runGit(dir string, args ...string) (string, error) {
	ctx, cancel := contextTimeout(gitOpTime)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", dir}, args...)...)
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("git %s: %v: %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
