// Package config loads Slate's runtime configuration from a .env file and the
// process environment. Real environment variables always override .env values.
package config

import (
	"bufio"
	"os"
	"strings"
)

// Config holds all runtime settings. Secrets (password, PAT) live here only in
// memory; nothing is written back to disk.
type Config struct {
	Port          string
	ShareBaseURL  string
	Password      string // plaintext from env; hashed in memory by the auth layer
	GitURL        string
	GitUser       string
	GitPAT        string
	DataDir       string
	DBPath        string
	AppName       string
}

// Load reads an optional .env file (key=value lines) then overlays os.Environ,
// applies defaults, and returns the resolved Config.
func Load(envPath string) Config {
	vals := parseEnvFile(envPath)

	get := func(key, def string) string {
		if v, ok := os.LookupEnv(strings.ToUpper(key)); ok && v != "" {
			return v
		}
		if v, ok := vals[strings.ToLower(key)]; ok && v != "" {
			return v
		}
		return def
	}

	return Config{
		Port:         get("port", "8080"),
		ShareBaseURL: strings.TrimRight(get("share_base_url", ""), "/"),
		// Accept the new SCRATCHPAD_PASSWORD; fall back to SLATE_PASSWORD for
		// existing setups.
		Password: firstNonEmpty(get("scratchpad_password", ""), get("slate_password", "")),
		GitURL:       get("git_url", ""),
		GitUser:      get("git_user", ""),
		GitPAT:       get("git_pat", ""),
		DataDir:      get("data_dir", "./data"),
		DBPath:       get("db_path", "./scratchpad.db"),
		AppName:      get("app_name", "Scratchpad"),
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// SyncEnabled reports whether git sync is configured. SSH URLs (git@host:...)
// authenticate via the deploy machine's SSH key/agent and need no PAT; HTTPS
// URLs need a PAT. Either way, a URL is the minimum requirement.
func (c Config) SyncEnabled() bool {
	return c.GitURL != ""
}

// GitIsSSH reports whether the remote uses SSH transport (git@host:... or ssh://).
func (c Config) GitIsSSH() bool {
	return strings.HasPrefix(c.GitURL, "git@") || strings.HasPrefix(c.GitURL, "ssh://")
}

// parseEnvFile reads simple KEY=VALUE lines, ignoring blanks and # comments.
// Keys are lowercased so lookups are case-insensitive. Surrounding quotes on
// values are stripped. Missing file => empty map (not an error).
func parseEnvFile(path string) map[string]string {
	out := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return out
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.ToLower(strings.TrimSpace(k))
		v = strings.TrimSpace(v)
		v = strings.Trim(v, `"'`)
		out[k] = v
	}
	return out
}
