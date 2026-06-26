package git

import (
	"fmt"
	"strconv"
	"strings"
)

// Commit is one revision in a file's history.
type Commit struct {
	Hash    string `json:"hash"`
	Short   string `json:"short"`
	Date    int64  `json:"date"`
	Message string `json:"message"`
}

// History returns commits that touched relPath (newest first). Returns nil if
// the data dir isn't a git repo (e.g. sync disabled) — callers treat that as
// "no history yet" rather than an error.
func History(dataDir, relPath string, limit int) ([]Commit, error) {
	if !isRepo(dataDir) {
		return nil, nil
	}
	const sep = "\x1f"
	out, err := runGit(dataDir, "log", fmt.Sprintf("-%d", limit),
		"--format=%H"+sep+"%h"+sep+"%ct"+sep+"%s", "--", relPath)
	if err != nil {
		return nil, err
	}
	var commits []Commit
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		f := strings.SplitN(line, sep, 4)
		if len(f) < 4 {
			continue
		}
		ts, _ := strconv.ParseInt(f[2], 10, 64)
		commits = append(commits, Commit{Hash: f[0], Short: f[1], Date: ts, Message: f[3]})
	}
	return commits, nil
}

// FileAtCommit returns the file's content as of a commit.
func FileAtCommit(dataDir, hash, relPath string) (string, error) {
	if !isRepo(dataDir) {
		return "", fmt.Errorf("not a git repo")
	}
	// Validate hash is a hex sha to avoid arg injection into the ref.
	if !isHex(hash) {
		return "", fmt.Errorf("invalid commit")
	}
	return runGit(dataDir, "show", hash+":"+relPath)
}

func isHex(s string) bool {
	if len(s) < 4 || len(s) > 40 {
		return false
	}
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}
