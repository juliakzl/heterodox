import { useEffect, useState } from 'react';
import { api } from './api';
import dayjs from 'dayjs';

// Robust, cross-browser formatter with graceful fallback
function formatWeek(dateStr) {
  if (!dateStr) return '—';
  const d = dayjs(dateStr);
  if (d.isValid()) return d.format('MMMM, D');
  // Fallback for odd strings or old cached bundles
  const native = new Date(dateStr);
  if (!Number.isNaN(native.getTime())) {
    return native.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
  return String(dateStr);
}

const Arrow = ({ open, disabled }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    style={{
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 120ms',
      opacity: disabled ? 0.3 : 1
    }}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function WeeklyFeed(){
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]);
  const [error, setError] = useState(null);

  const [expanded, setExpanded] = useState({});           // { [week_start]: boolean }
  const [answersByWeek, setAnswersByWeek] = useState({}); // { [week_start]: array }
  const [loadingAns, setLoadingAns] = useState({});       // { [week_start]: boolean }
  const [errorAns, setErrorAns] = useState({});           // { [week_start]: string|null }

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Expected API response: { weeks: [{ week_start, question: { id, text }, answers_count }] }
      const j = await api('/api/weekly/history');
      setWeeks(Array.isArray(j.weeks) ? j.weeks : []);
    } catch (e) {
      setError(e.message || 'Failed to load weekly history.');
    } finally {
      setLoading(false);
    }
  };

  const loadAnswers = async (weekStart) => {
    setLoadingAns(s => ({ ...s, [weekStart]: true }));
    setErrorAns(s => ({ ...s, [weekStart]: null }));
    try {
      const j = await api(`/api/weekly/${encodeURIComponent(weekStart)}/answers`);
      setAnswersByWeek(s => ({ ...s, [weekStart]: Array.isArray(j.answers) ? j.answers : [] }));
    } catch (e) {
      setErrorAns(s => ({ ...s, [weekStart]: e.message || 'Failed to load answers' }));
    } finally {
      setLoadingAns(s => ({ ...s, [weekStart]: false }));
    }
  };
  
  const toggleWeek = (weekStart, hasQuestion) => {
    if (!hasQuestion) return;
    setExpanded(s => {
      const next = { ...s, [weekStart]: !s[weekStart] };
      if (next[weekStart] && !answersByWeek[weekStart]) {
        loadAnswers(weekStart);
      }
      return next;
    });
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="card">
        <h3>Feed</h3>
        <div className="muted">Loading…</div>
        <div style={{marginTop:8}}>
          <button className="secondary" onClick={load}>Refresh</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Feed</h3>
        <div className="muted" style={{color:'crimson'}}>{error}</div>
        <div style={{marginTop:8}}>
          <button className="secondary" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  if (!weeks || weeks.length === 0) {
    return (
      <div className="card">
        <h3>Feed</h3>
        <div className="muted">No past weekly questions yet.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Feed</h3>
      <div className="list">
        {weeks.map(w => {
          const hasQ = !!w?.question?.id || !!w?.question?.text;
          const isOpen = !!expanded[w.week_start];
          const ans = answersByWeek[w.week_start] || [];
          const isLoading = !!loadingAns[w.week_start];
          const ansErr = errorAns[w.week_start];
          const askerName =
            w?.question?.asked_by_name ??
            w?.question?.asked_by_display_name ??
            w?.question?.asker_name ??
            w?.question?.user_display_name ??
            null;

          return (
            <div key={w.week_start} className="answer">
              {/* 1) Week pill */}
              <div className="pill">Week starting {formatWeek(w.week_start)}</div>

              {/* 2) Question text */}
              <div style={{marginTop:6, marginBottom:6}}>
                {w?.question?.text || <span className="muted">No question recorded</span>}
              </div>
              {askerName && (
                <div className="muted" style={{ marginTop: 0, marginBottom: 6, fontSize: 12 }}>
                  Asked by {askerName}
                </div>
              )}

              {/* 3) Answers count pill (optional) */}
              {typeof w.answers_count === 'number' && (
                <div className="pill">{w.answers_count} answers</div>
              )}

              {/* 4) Chevron toggle row BELOW the question */}
              <div
                className="row"
                style={{alignItems:'center', marginTop:4}}
                aria-expanded={isOpen}
                aria-controls={`answers-${w.week_start}`}
              >
                <span
                  onClick={() => hasQ && toggleWeek(w.week_start, hasQ)}
                  role="button"
                  aria-label={isOpen ? 'Hide answers' : 'Show answers'}
                  style={{display:'inline-flex', alignItems:'center', gap:8, cursor: hasQ ? 'pointer' : 'not-allowed'}}
                >
                  <Arrow open={isOpen} disabled={!hasQ} />
                </span>
                <div style={{flex:1}}></div>
              </div>

              {/* 5) Collapsible answers */}
              {isOpen && (
                <div id={`answers-${w.week_start}`} style={{marginTop:8, borderTop:'1px solid #eee', paddingTop:8}}>
                  {isLoading && <div className="muted">Loading answers…</div>}
                  {ansErr && <div className="muted" style={{color:'crimson'}}>{ansErr}</div>}
                  {!isLoading && !ansErr && ans.length === 0 && (
                    <div className="muted">No answers yet.</div>
                  )}
                  {!isLoading && !ansErr && ans.length > 0 && (
                    <div className="list">
                      {ans.map(a => (
                        <div key={a.id} className="answer">
                          <div className="muted">
  {(a.respondent_name || 'Unknown')} • {dayjs(a.created_at).format('YYYY-MM-DD HH:mm')}
</div>
                          <div style={{marginTop:6, marginBottom:6}}>{a.text}</div>
                          <div className="pill">{a.votes} upvotes</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}