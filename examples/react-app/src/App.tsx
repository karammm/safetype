import { useState, type FormEvent } from "react";
import { SafeTypeInput, SafeTypeProvider, SafeTypeTextarea, useModeration } from "@safetype/react";

interface Comment {
  name: string;
  body: string;
}

function Preview({ text }: { text: string }) {
  // Moderate any string during render, e.g. a live preview in "suggest" mode.
  const { suggestedText, matches } = useModeration(text, { mode: "suggest" });
  if (!matches.length) return null;
  return <p style={{ color: "#555" }}>Suggestion: “{suggestedText}”</p>;
}

export function App() {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

  function submit(event: FormEvent) {
    // Only runs when no field is blocked: SafeType stops blocked submissions first.
    event.preventDefault();
    setComments((c) => [...c, { name, body }]);
    setBody("");
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px", font: "16px/1.5 system-ui, sans-serif" }}>
      <h1>Comments</h1>
      {/* One configuration for every field: mask swearing, block targeted harassment. */}
      <SafeTypeProvider mode="mask" policy={{ harassment: { action: "block" } }} customWords={["frak"]}>
        <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
          <label htmlFor="name">Name</label>
          <SafeTypeInput id="name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="body">Comment</label>
          <SafeTypeTextarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <Preview text={body} />
          <button type="submit">Post</button>
        </form>
      </SafeTypeProvider>
      <ul>
        {comments.map((c, i) => (
          <li key={i}>
            <strong>{c.name || "Anonymous"}:</strong> {c.body}
          </li>
        ))}
      </ul>
      <p style={{ color: "#777", fontSize: 14 }}>Your server should still re-check comments with @safetype/core.</p>
    </main>
  );
}
