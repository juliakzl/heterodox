import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from './api';
import MatisseTheme from './MatisseTheme';
import WeeklyFeed from './Feed';

function SignIn({ onDone }){
  const [name,setName]=useState('');
  const [mode,setMode]=useState('register');
  const go = async () => {
    if (!name.trim()) return;
    try {
      if (mode==='register') await api('/api/register',{method:'POST', body:JSON.stringify({displayName:name.trim()})});
      else await api('/api/login',{method:'POST', body:JSON.stringify({displayName:name.trim()})});
      onDone();
    } catch(e){ alert(e.message); }
  };
  return (
    <div className="container">
      <div className="card">
        <h2>heterodox</h2>
        <p className="muted">A daily spark: ask a question in the morning, read anonymized answers from your circle at 20:00.</p>
        <div className="row">
          <input placeholder="Display name" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={go}>{mode==='register'?'Register':'Sign in'}</button>
        </div>
        <div style={{marginTop:8}}>
          <button className="secondary" onClick={()=>setMode(mode==='register'?'login':'register')}>
            Switch to {mode==='register'?'Sign in':'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** NEW: Welcome screen for invite links (unauthenticated) */
function WelcomeInvite({ token }) {
  const [answer, setAnswer] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const minLen = 10;

  const shareAndJoin = async () => {
    setErr(null);
    const a = answer.trim();
    if (a.length < minLen) {
      setErr(`Please write at least ${minLen} characters.`);
      return;
    }
    try {
      setBusy(true);
      // Stash the answer so we can finish after Google auth redirects back.
      localStorage.setItem('pendingInvite', JSON.stringify({ token, answer: a }));
      // Kick off Google Sign-In (server will redirect back to frontend root)
      window.location.href = '/api/auth/google?invite=' + encodeURIComponent(token);
    } catch (e) {
      setBusy(false);
      setErr(e.message || 'Something went wrong.');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Welcome to heterodox</h2>
        <p className="muted">
          To join this community, first share your answer to the starter prompt below.
        </p>
        <div style={{marginTop:12}}>
          <div className="pill">Prompt</div>
          <h3 style={{marginTop:8}}>What is the most interesting question you’ve ever been asked?</h3>
        </div>
        <div style={{marginTop:8}}>
          <textarea
            rows="5"
            placeholder="Write your answer…"
            value={answer}
            onChange={e=>setAnswer(e.target.value)}
          />
          <div className="muted" style={{marginTop:6}}>
            {answer.trim().length}/{minLen} minimum
          </div>
        </div>
        {err && <div className="muted" style={{color:'crimson', marginTop:8}}>{err}</div>}
        <div style={{marginTop:12}}>
          <button onClick={shareAndJoin} disabled={busy || answer.trim().length < minLen}>
            {busy ? 'Redirecting…' : 'Share & Join with Google'}
          </button>
        </div>
        <div className="muted" style={{marginTop:8}}>
          You’ll be prompted to sign in with Google to create your account and save your answer.
        </div>
      </div>
    </div>
  );
}

function TodayMain({ setTab }) {
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState(null); // payload from /api/weekly
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  const fetchWeekly = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/weekly');
      setWeekly(data);
    } catch (e) {
      setError(e.message || 'Failed to load this week’s question.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWeekly(); }, []);
  const shareWeekly = async () => {
  const q = weekly?.question;
  if (!q) return;
  const shareData = {
    title: "This Week’s Question",
    text: q.text,
    url: window.location.origin + "?week=" + encodeURIComponent(weekly?.week_start || "")
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}\n${shareData.url}`);
      alert("Link copied to clipboard.");
    }
  } catch (_) {
    // user likely canceled; ignore
  }
};

  const submit = async () => {
    const text = draft.trim();
    const q = weekly?.question;
    if (!q) return;
    if (text.length < 3) {
      alert('Please write at least 3 characters.');
      return;
    }
    try {
      await api('/api/answers', {
        method: 'POST',
        body: JSON.stringify({ questionId: q.id, text })
      });
      setDraft('');
      await fetchWeekly();
    } catch (e) {
      alert(e.message || 'Failed to submit your answer.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h3>This Week</h3>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>This Week</h3>
        <div className="muted" style={{color:'crimson'}}>{error}</div>
      </div>
    );
  }

  const q = weekly?.question || null;
  const phase = weekly?.phase;
  const iAnswered = !!weekly?.iAnswered;

  if (!q) {
    return (
      <div className="card">
        <h3>This Week</h3>
        <div className="muted">No weekly question has been published yet.</div>
        <div style={{marginTop:12}}>
          <button onClick={() => setTab('Ask')}>Add a question to the community</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{margin:0}}>This Week’s Question</h3>
      <div className="pill" style={{marginTop:8}}>
        Week starting {weekly.week_start}
      </div>
      <p style={{marginTop:8, marginBottom:12}}>{q.text}</p>

      {/* Answers thread */}
      <div>
        {Array.isArray(weekly.answers) && weekly.answers.length > 0 ? (
          <div className="list">
            {weekly.answers.map(a => (
              <div key={a.id} className="answer">
                <div className="muted">Anonymous • {dayjs(a.created_at).format('HH:mm')}</div>
                <div style={{marginTop:6, marginBottom:6}}>{a.text}</div>
                <div className="pill">{a.votes} upvotes</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No answers available yet.</div>
        )}
      </div>
    </div>
  );
}
function Connections(){
  const [list,setList]=useState([]);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState([]);

  const load = async()=>{
    const j = await api('/api/connections');
    setList(j.connections);
  };
  useEffect(()=>{ load(); },[]);

  const search = async (q)=>{
    setQuery(q);
    if (!q.trim()) return setResults([]);
    const j = await api('/api/users/search?q='+encodeURIComponent(q.trim()));
    setResults(j.users);
  };
  const add = async (name)=>{
    try{
      await api('/api/connections/add',{method:'POST', body:JSON.stringify({peerDisplayName:name})});
      setQuery(''); setResults([]); load();
    }catch(e){ alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Connections</h3>
      <div className="row">
        <input placeholder="Search names…" value={query} onChange={e=>search(e.target.value)} />
      </div>
      {results.length>0 && (
        <div className="list">
          {results.map(u=>(
            <div key={u.id} className="row">
              <div>{u.display_name}</div>
              <div style={{flex:'none'}}>
                <button onClick={()=>add(u.display_name)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{marginTop:12}} className="list">
        {list.map(c=>(<div key={c.id} className="pill">{c.display_name}</div>))}
        {list.length===0 && <div className="muted">No connections yet. Add some to exchange answers.</div>}
      </div>
    </div>
  );
}

function Ask({ onClose = () => {} }) {
  const [mine, setMine] = useState(null);
  const [text, setText] = useState('');

  const load = async () => {
    const j = await api('/api/questions/mine');
    setMine(j.question);
  };
  useEffect(() => { load(); }, []);

  const post = async () => {
    if (text.trim().length < 5) return alert('Min 5 chars');
    try {
      await api('/api/questions', { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
      setText(''); load();
    } catch (e) { alert(e.message); }
  };

  // Modal styles: backdrop covering screen, panel pinned top-right
  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  };
  const panelStyle = {
    position: 'fixed',
    top: 16,
    right: 16,
    width: 'min(520px, 95vw)',
    maxHeight: '85vh',
    overflow: 'auto',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    padding: 16,
    zIndex: 1000,
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button aria-label="Close" onClick={onClose} style={backdropStyle}></button>
      <div style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="ask-title">
        <div style={{ position: 'relative' }}>
          <h3 id="ask-title" style={{ marginRight: 28 }}>Ask (today)</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              position: 'absolute',
              top: -8,
              right: -8
            }}
          >✕</button>
        </div>
        {mine ? (
          <div>
            <div className="pill">Posted {mine.qdate}</div>
            <p style={{ marginTop: 8 }}>{mine.text}</p>
          </div>
        ) : (
          <div>
            <textarea rows="3" placeholder="What question are you putting to your circle today?" value={text} onChange={e => setText(e.target.value)} />
            <div style={{ marginTop: 8 }}>
              <button onClick={post}>Post question</button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>You can post one question per day.</div>
          </div>
        )}
      </div>
    </>
  );
}


function Reveal(){
  const [mine,setMine]=useState(null);
  const [answers,setAnswers]=useState([]);
  const [err,setErr]=useState(null);

  const loadMine = async()=>{
    const j = await api('/api/questions/mine');
    setMine(j.question);
    setErr(null);
  };
  const loadAnswers = async()=>{
    if (!mine) return;
    try{
      const j = await api('/api/questions/'+mine.id+'/answers');
      setAnswers(j.answers);
      setErr(null);
    }catch(e){ setErr(e.message); }
  };

  useEffect(()=>{ loadMine(); },[]);
  useEffect(()=>{ if (mine) loadAnswers(); },[mine]);

  const upvote = async (id)=>{
    try{
      await api('/api/answers/'+id+'/vote', {method:'POST'});
      loadAnswers();
    }catch(e){ alert(e.message); }
  };

  return (
    <div className="card">
      <h3>Reveal (after 20:00)</h3>
      {!mine && <div className="muted">Post a question in Ask to see answers here later today.</div>}
      {mine && (
        <div>
          <div className="pill">Your question • {mine.qdate}</div>
          <div style={{marginTop:6, marginBottom:6}}>{mine.text}</div>
          {err && <div className="muted">Not available yet: {err}</div>}
          <div className="list">
            {answers.map(a=>(
              <div key={a.id} className="answer">
                <div className="muted">Anonymous • {dayjs(a.created_at).format('HH:mm')}</div>
                <div style={{marginTop:6, marginBottom:6}}>{a.text}</div>
                <div className="row" style={{alignItems:'center'}}>
                  <div className="pill">{a.votes} upvotes</div>
                  <div style={{flex:'none'}}><button onClick={()=>upvote(a.id)}>Upvote</button></div>
                </div>
              </div>
            ))}
            {answers.length===0 && !err && <div className="muted">No answers yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ me, onLogout, tab, setTab }){
  return (
    <div className="card" style={{position:'sticky', top:0, zIndex:10}}>
      <div className="row" style={{alignItems:'center'}}>
        <div style={{fontWeight:700}}>heterodox</div>
        <div style={{flex:1}}></div>
        <div className="pill">{me?.displayName}</div>
        <button className="secondary" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}

export default function App(){
  const [me,setMe]=useState(null);
  const [tab,setTab]=useState('Main');

  const inviteToken = new URLSearchParams(window.location.search).get('invite') || null;

  // After login, finalize any pending invite we stashed before auth.
  const finishPendingInvite = async () => {
    const raw = localStorage.getItem('pendingInvite');
    if (!raw) return;
    try {
      const { token, answer } = JSON.parse(raw);
      if (!token || !answer) return;
      await api('/api/invite/accept', {
        method: 'POST',
        body: JSON.stringify({ token, answer })
      });
    } catch (e) {
      // You may want to surface this in UI; for now, log it.
      console.error('Failed to finalize invite:', e);
    } finally {
      localStorage.removeItem('pendingInvite');
    }
  };

  const load = async()=>{
    const j = await api('/api/me'); 
    setMe(j.user);
    if (j.user) {
      await finishPendingInvite();
    }
  };
  useEffect(()=>{ load(); },[]);

  const logout = async()=>{ await api('/api/logout',{method:'POST'}); setMe(null); };

  // NEW: If unauthenticated AND invite token exists → show WelcomeInvite first.
  if (!me && inviteToken) return (<>
    <MatisseTheme />
    <WelcomeInvite token={inviteToken} />
  </>);

  if (!me) {
    // No manual sign-in/registration, only Google Sign-In for non-invite users
    return (
      <>
        <MatisseTheme />
        <div className="container" style={{textAlign: 'center', marginTop: '20vh'}}>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to continue</p>
          <a href="/api/auth/google" className="btn">Continue with Google</a>
        </div>
      </>
    );
  }

  return (
    <>
      <MatisseTheme />
      <div className="container">
        <Nav me={me} onLogout={logout} tab={tab} setTab={setTab} />
      
        {/* MAIN: Ask button (top-right) + This Week’s Question */}
        {tab==='Main' && (
          <>
            <div className="card" style={{display:'flex', justifyContent:'flex-end', alignItems:'center', marginBottom:12}}>
              <button onClick={()=>setTab('Ask')}>Ask a question</button>
            </div>
            <TodayMain setTab={setTab} />
            <div style={{marginTop:16}} />
          </>
        )}
      
        {/* FEED tab content (placeholder or use Reveal for now) */}
        {tab==='Feed' && (
          <>
            <WeeklyFeed />
            <div style={{marginTop:16}} />
          </>
        )}
      
        {/* CONNECTIONS tab */}
        {tab==='Connections' && (
          <>
            <Connections />
            <div style={{marginTop:16}} />
          </>
        )}
      
        {/* Ask modal only when invoked */}
        {tab==='Ask' && <Ask onClose={()=>setTab('Main')} />}
      
        {/* Spacer so content isn't hidden behind bottom nav */}
        <div style={{height:72}} />
      
        {/* Bottom menu with three tabs: Feed, Main, Connections */}
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            background: '#fff',
            borderTop: '1px solid #eee'
          }}
        >
          <div className="container" style={{paddingTop:8, paddingBottom:8}}>
            <div className="row" style={{justifyContent:'space-around'}}>
              <button className={tab==='Feed' ? '' : 'secondary'} onClick={()=>setTab('Feed')}>Feed</button>
              <button className={tab==='Main' ? '' : 'secondary'} onClick={()=>setTab('Main')}>Main</button>
              <button className={tab==='Connections' ? '' : 'secondary'} onClick={()=>setTab('Connections')}>Connections</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}