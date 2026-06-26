package httpapi

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/phoenix911/scratchpad/internal/config"
	"github.com/phoenix911/scratchpad/internal/store"
)

const (
	sessionCookie = "scratchpad_session"
	sessionTTL    = 30 * 24 * time.Hour
	secretSetting = "session_secret"
)

// authenticator implements the single-password gate. Sessions are stateless,
// HMAC-signed cookies; the signing secret is persisted in settings so sessions
// survive restarts.
type authenticator struct {
	password string // configured plaintext (from env); compared in constant time
	secret   []byte
}

func newAuthenticator(cfg config.Config, st *store.Store) (*authenticator, error) {
	secret, err := loadOrCreateSecret(st)
	if err != nil {
		return nil, err
	}
	return &authenticator{password: cfg.Password, secret: secret}, nil
}

func loadOrCreateSecret(st *store.Store) ([]byte, error) {
	if v, err := st.GetSetting(secretSetting); err != nil {
		return nil, err
	} else if v != "" {
		return base64.StdEncoding.DecodeString(v)
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	if err := st.SetSetting(secretSetting, base64.StdEncoding.EncodeToString(b)); err != nil {
		return nil, err
	}
	return b, nil
}

// require is middleware that 401s unauthenticated requests.
func (a *authenticator) require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.valid(r) {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// valid reports whether the request carries a valid, unexpired session cookie.
// If no password is configured, the app is open (local-only convenience).
func (a *authenticator) valid(r *http.Request) bool {
	if a.password == "" {
		return true
	}
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return false
	}
	return a.verifyToken(c.Value)
}

func (a *authenticator) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if a.password != "" &&
		subtle.ConstantTimeCompare([]byte(body.Password), []byte(a.password)) != 1 {
		writeErr(w, http.StatusUnauthorized, "wrong password")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    a.signToken(time.Now().Add(sessionTTL)),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil || forwardedHTTPS(r),
		MaxAge:   int(sessionTTL.Seconds()),
	})
	writeJSON(w, http.StatusOK, map[string]any{"authed": true})
}

func (a *authenticator) handleLogout(w http.ResponseWriter, _ *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", HttpOnly: true, MaxAge: -1,
	})
	writeJSON(w, http.StatusOK, map[string]any{"authed": false})
}

// signToken returns "<expiryUnix>.<base64 hmac>".
func (a *authenticator) signToken(expiry time.Time) string {
	payload := strconv.FormatInt(expiry.Unix(), 10)
	return payload + "." + a.mac(payload)
}

func (a *authenticator) verifyToken(tok string) bool {
	payload, sig, ok := strings.Cut(tok, ".")
	if !ok {
		return false
	}
	if subtle.ConstantTimeCompare([]byte(sig), []byte(a.mac(payload))) != 1 {
		return false
	}
	exp, err := strconv.ParseInt(payload, 10, 64)
	if err != nil {
		return false
	}
	return time.Now().Unix() < exp
}

func (a *authenticator) mac(payload string) string {
	h := hmac.New(sha256.New, a.secret)
	h.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

// forwardedHTTPS detects TLS terminated by a tunnel/reverse proxy.
func forwardedHTTPS(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
