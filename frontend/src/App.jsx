import { useEffect, useState } from "react";

function useApi(url) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => active && setState({ loading: false, error: null, data }))
      .catch((error) => active && setState({ loading: false, error: error.message, data: null }));
    return () => {
      active = false;
    };
  }, [url]);

  return state;
}

function Panel({ title, state }) {
  return (
    <section>
      <h2>{title}</h2>
      {state.loading && <p>Loading…</p>}
      {state.error && <p className="error">{state.error}</p>}
      {state.data && <pre>{JSON.stringify(state.data, null, 2)}</pre>}
    </section>
  );
}

export default function App() {
  const hello = useApi("/api/hello");
  const health = useApi("/api/health");

  return (
    <main>
      <h1>Full-stack template</h1>
      <Panel title="GET /api/hello" state={hello} />
      <Panel title="GET /api/health" state={health} />
    </main>
  );
}
