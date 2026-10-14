# Server-side enforcement example

Client-side moderation is a UX feature, not a security boundary. A user can disable
JavaScript, edit the DOM, or call your API directly with `curl`. Policies must be enforced
where content is stored, by re-running the same engine on the server.

```bash
pnpm install && pnpm build          # from the repository root
pnpm --filter @safetype/example-node-server start
```

```bash
# Profanity is masked and stored
curl -s -X POST localhost:3000/posts -d '{"text":"What the fuck is this?"}'
# {"id":1,"text":"What the f*ck is this?","needsReview":false}

# Targeted harassment is rejected
curl -s -X POST localhost:3000/posts -d '{"text":"you are a worthless idiot"}'
# 422 {"error":"Content violates community guidelines","violations":[...]}
```

`needsReview` is true when a hate or harassment signal fell below the confidence threshold
(for example inside quotes). Route those to a human moderation queue instead of auto-rejecting them.
