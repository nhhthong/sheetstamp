import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    window.sheetstamp.ping({ message: "ping" }).then((res) => setVersion(res.version));
  }, []);

  return (
    <main>
      <h1>Sheetstamp</h1>
      <p data-testid="version">{version ? `Phiên bản ${version}` : "Đang tải…"}</p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
