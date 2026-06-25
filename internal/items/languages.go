package items

import "strings"

// langToExt maps an editor language id to the file extension used on disk, so
// snippets are stored as real source files (nice git diffs + GitHub rendering).
var langToExt = map[string]string{
	"text":       "txt",
	"plaintext":  "txt",
	"markdown":   "md",
	"javascript": "js",
	"jsx":        "jsx",
	"typescript": "ts",
	"tsx":        "tsx",
	"json":       "json",
	"html":       "html",
	"css":        "css",
	"scss":       "scss",
	"python":     "py",
	"go":         "go",
	"rust":       "rs",
	"java":       "java",
	"kotlin":     "kt",
	"c":          "c",
	"cpp":        "cpp",
	"csharp":     "cs",
	"php":        "php",
	"ruby":       "rb",
	"swift":      "swift",
	"sql":        "sql",
	"yaml":       "yaml",
	"toml":       "toml",
	"shell":      "sh",
	"bash":       "sh",
	"dockerfile": "dockerfile",
	"xml":        "xml",
}

// extToLang is the reverse map, used during disk→DB reconcile.
var extToLang = func() map[string]string {
	m := map[string]string{
		"txt":  "text",
		"yml":  "yaml",
		"htm":  "html",
		"cc":   "cpp",
		"cxx":  "cpp",
		"h":    "c",
		"hpp":  "cpp",
		"mjs":  "javascript",
		"cjs":  "javascript",
	}
	for lang, ext := range langToExt {
		if _, exists := m[ext]; !exists {
			m[ext] = lang
		}
	}
	return m
}()

// extForLanguage returns the file extension for a language id (defaults to txt).
func extForLanguage(lang string) string {
	if ext, ok := langToExt[strings.ToLower(lang)]; ok {
		return ext
	}
	return "txt"
}

// languageForExt returns the language id for a file extension (defaults to the
// extension itself so unknown types still round-trip).
func languageForExt(ext string) string {
	ext = strings.ToLower(strings.TrimPrefix(ext, "."))
	if lang, ok := extToLang[ext]; ok {
		return lang
	}
	if ext == "" {
		return "text"
	}
	return ext
}
