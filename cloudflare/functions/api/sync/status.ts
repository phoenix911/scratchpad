import type { Env } from "../../_lib/types";
import { json } from "../../_lib/json";

export const onRequestGet: PagesFunction<Env> = async () =>
  json({ enabled: false, state: "off", lastSync: 0, message: "" });
