package git

import (
	"context"
	"time"
)

// contextTimeout returns a context that cancels after d — bounding each git
// invocation so a hung network op can't block sync forever.
func contextTimeout(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
