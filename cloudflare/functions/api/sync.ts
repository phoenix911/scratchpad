import type { Env } from "../_lib/types";
import { json } from "../_lib/json";

// No git sync at the edge — the data lives in R2/D1. Report disabled so the UI
// sync pill stays hidden.
const status = { enabled: false, state: "off", lastSync: 0, message: "" };

export const onRequestPost: PagesFunction<Env> = async () => json(status);
