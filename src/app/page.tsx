export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>OpenChat</h1>
      <p>Open-source Instagram comment-to-DM automation with a follower gate.</p>
      <ul>
        <li>
          Webhook: <code>/api/webhooks/instagram</code>
        </li>
        <li>
          OAuth callback: <code>/api/oauth/instagram/callback</code>
        </li>
      </ul>
      <p>
        Run the pipeline with no API keys: <code>npm run simulate -- follower</code>
      </p>
    </main>
  );
}
