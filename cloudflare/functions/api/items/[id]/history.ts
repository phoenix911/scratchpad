import type { Env } from "../../../_lib/types";
import { json } from "../../../_lib/json";

// Version history is git-backed in the Go app; the edge deployment has no git,
// so it reports an empty history (the UI hides the panel when empty).
export const onRequestGet: PagesFunction<Env> = async () => json({ commits: [], syncEnabled: false });
