import type { Env } from "../_lib/types";
import { json, err, noContent, readJSON } from "../_lib/json";
import * as db from "../_lib/d1";
import * as items from "../_lib/items";
import { cleanFolder } from "../_lib/ids";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => json({ folders: await db.activeFolders(env) });

// create | rename | delete | archive | unarchive | trash (mirrors handleFolderAction).
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJSON<{ action?: string; name?: string; newName?: string }>(request);
  const name = body.name ?? "";
  try {
    switch (body.action) {
      case "create": {
        // Folders exist implicitly (a folder appears once an item lives in it).
        const clean = cleanFolder(name);
        if (!clean) return err(400, "empty folder name");
        return json({ folder: clean }, 201);
      }
      case "rename":
        return json({ folder: await items.renameFolder(env, name, body.newName ?? "") });
      case "delete":
        // No hard delete at the edge — send the folder's items to the recycle bin.
        await items.trashFolder(env, name);
        return noContent();
      case "archive":
      case "unarchive":
        return json({ moved: await items.archiveFolder(env, name, body.action === "archive") });
      case "trash":
        return json({ moved: await items.trashFolder(env, name) });
      default:
        return err(400, "unknown action");
    }
  } catch (e) {
    if (e instanceof items.HttpError) return err(e.status, e.message);
    throw e;
  }
};
