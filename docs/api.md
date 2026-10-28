# Homebase API v1

All endpoints require Sites-verified identity and private Site visitor access. API routes do not accept browser-stored API keys. Same-origin JSON browser writes only; cross-origin requests return 403. APIs and data responses use no-store. Never change the Site to public to enable a client. Third-party integrations should use the generated Sites MCP plugin, not copy a service bypass token into prompts or clients.

`GET /api/homebase` returns records `{id,kind,data,version,updatedAt}`. `POST /api/homebase` accepts JSON:

- `{action:"save",kind,data}` creates a record. Include `id` and current `version` to update. Stale updates return 409; reload and ask the user to resolve their edits.
- `{action:"delete",id,version}` permanently deletes a record; UI asks first. Prefer completing projects to deleting them.
- `{action:"import_recipes",recipes:[...]}` validates every recipe before writes (up to 50). A transport/storage failure can leave a partial import; refresh before retrying.
- `{action:"generate_groceries",start:"YYYY-MM-DD",end:"YYYY-MM-DD"}` rebuilds uncompleted generated entries from cook nights in the inclusive range. Preserves manual entries, staples, pantry and checked history. Avoid concurrent generation from two devices.

Record schemas are defined in `lib/domain.ts`. Recipe example:

```json
{"title":"White bean soup","servings":4,"minutes":35,"ingredients":[{"name":"White beans","quantity":2,"unit":"cans","category":"Canned & dry"}],"instructions":"Rinse beans. Simmer with vegetables and stock.","tags":["Vegetarian"],"notes":"Add lemon before serving.","likes":[]}
```

Plan example:

```json
{"action":"save","kind":"meal","data":{"date":"2026-11-02","title":"White bean soup","recipeId":"ID_FROM_RECIPE_LIST","type":"cook","servings":6}}
```

Project example:

```json
{"action":"save","kind":"project","data":{"title":"Organize a shelf","type":"project","priority":"low","due":"","reminder":"","notes":"","completed":false,"subtasks":[]}}
```

`POST /mcp` exposes stateless JSON-RPC `server/discover`, `tools/list`, and `tools/call`. `homebase_list` reads all household records; `homebase_write` supports save, import_recipes, generate_groceries. For completion, read the current project and save with `completed:true`, preserving the rest of its data and passing its id/version. Sites authenticates plugin callers and injects verified identity. An agent must show/confirm the intended household changes as appropriate for the user's request. MCP tool provisioning is not proof the plugin is installed or that this conversation can invoke it.

No server-side external API integration is configured. Future service credentials must be Sites runtime secrets. No GitHub Actions relay is needed for this application.
