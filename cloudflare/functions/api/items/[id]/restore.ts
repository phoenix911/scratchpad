import type { Env } from "../../../_lib/types";
import { err } from "../../../_lib/json";

// No git history at the edge → nothing to restore from.
export const onRequestPost: PagesFunction<Env> = async () => err(501, "version history is not available on this deployment");
