export function App() {
  return (
    <main className="welcome-screen">
      <section className="welcome-card" aria-labelledby="app-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Asset workspace</p>
        <h1 id="app-title">Assets Pipeline</h1>
        <p className="welcome-copy">Tu espacio de trabajo para organizar y preparar assets.</p>
        <p className="version-label">Versión {__APP_VERSION__}</p>
      </section>
    </main>
  );
}
