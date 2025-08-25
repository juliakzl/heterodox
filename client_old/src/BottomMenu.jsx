export default function BottomMenu({ tab, setTab }) {
  return (
    <div className="card" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <button
          aria-label="Feed"
          className={tab === 'Answer' ? '' : 'secondary'}
          onClick={() => setTab('Answer')}
          style={{ flex: 1 }}
        >
          Feed
        </button>
        <button
          aria-label="Main"
          className={tab === 'Ask' ? '' : 'secondary'}
          onClick={() => setTab('Ask')}
          style={{ flex: 1 }}
        >
          Main
        </button>
        <button
          aria-label="Connections"
          className={tab === 'Connections' ? '' : 'secondary'}
          onClick={() => setTab('Connections')}
          style={{ flex: 1 }}
        >
          Connections
        </button>
      </div>
    </div>
  );
}