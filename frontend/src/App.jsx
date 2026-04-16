import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'

function App() {
  const [session, setSession] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0) // Tracks the dynamic loading text
  const [error, setError] = useState('')
  const [savedDecks, setSavedDecks] = useState([])
  const [cards, setCards] = useState([])
  const [studyMode, setStudyMode] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  // Loading messages array
  const loadingMessages = [
    "Extracting text from PDF...",
    "Chunking data for AI context...",
    "Generating SM-2 optimized cards...",
    "Finalizing deck layout..."
  ]

  // Dynamic loading state effect
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 3500); // Changes text every 3.5 seconds
    } else {
      setLoadingStep(0); // Reset when loading finishes
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // FIX: Forces app to reset to the Library whenever auth changes
      setStudyMode(false)
      setCurrentIndex(0)
      setIsFlipped(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) fetchDecks() }, [session])

  const fetchDecks = async () => {
    const { data, error } = await supabase.from('decks').select('*').order('created_at', { ascending: false })
    if (!error) setSavedDecks(data)
  }

  const handleUpload = async (e) => {
    e.preventDefault(); if (!file) return;
    setLoading(true); setError('');
    const formData = new FormData(); formData.append('file', file);
    
    try {
      const resp = await fetch('http://localhost:8000/api/generate', { method: 'POST', body: formData });
      
      // Error Resilience: Catch server crashes (500) or bad requests (400)
      if (!resp.ok) throw new Error("Server rejected the file. Try a smaller or text-heavy PDF.");
      
      const data = await resp.json();
      
      // Error Resilience: Catch AI failing to find flashcards
      if (!data.cards || data.cards.length === 0) throw new Error("AI couldn't extract any flashcards from this document. Please try another PDF.");

      const { data: deckData, error: dErr } = await supabase.from('decks').insert([{ name: file.name.replace('.pdf', '') }]).select().single();
      if (dErr) throw dErr;
      
      const cardsToInsert = data.cards.map(c => ({
        deck_id: deckData.id, front: c.front, back: c.back,
        interval: 1, ease_factor: 2.5, repetitions: 0, next_review: new Date().toISOString()
      }));
      await supabase.from('cards').insert(cardsToInsert);
      
      fetchDecks(); setLoading(false); setFile(null);
    } catch (err) { 
      console.error(err);
      setError(err.message || "Generation failed. Ensure the local server is running."); 
      setLoading(false); 
    }
  }

  const deleteDeck = async (id) => {
    if (!confirm("Delete entire deck?")) return;
    await supabase.from('decks').delete().eq('id', id);
    fetchDecks();
  }

  const deleteCurrentCard = async () => {
    if (!confirm("Delete card?")) return;
    await supabase.from('cards').delete().eq('id', cards[currentIndex].id);
    const updated = cards.filter((_, i) => i !== currentIndex);
    if (updated.length === 0) { setStudyMode(false); fetchDecks(); }
    else {
      setCards(updated);
      if (currentIndex >= updated.length) setCurrentIndex(updated.length - 1);
      setIsFlipped(false);
    }
  }

  const saveCardEdit = async () => {
    await supabase.from('cards').update({ front: editFront, back: editBack }).eq('id', cards[currentIndex].id);
    const updated = [...cards];
    updated[currentIndex] = { ...updated[currentIndex], front: editFront, back: editBack };
    setCards(updated);
    setIsEditing(false);
  }

  const startStudySession = async (deckId) => {
    const now = new Date().toISOString();
    
    // Only fetch cards where the review date is less than or equal to right now
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .lte('next_review', now);

    if (!data || data.length === 0) {
      alert("You're all caught up! No cards due for this deck right now.");
      return;
    }

    setCards(data.sort((a, b) => new Date(a.next_review) - new Date(b.next_review)));
    setStudyMode(true); setCurrentIndex(0); setIsFlipped(false);
  }

  const handleRating = async (rating) => {
    const card = cards[currentIndex];
    let { interval, ease_factor, repetitions } = card;
    if (rating < 3) { repetitions = 0; interval = 1; } 
    else {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * ease_factor);
      repetitions += 1;
    }
    ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));
    const nextReview = new Date(); nextReview.setDate(nextReview.getDate() + interval);
    await supabase.from('cards').update({ interval, ease_factor, repetitions, next_review: nextReview.toISOString() }).eq('id', card.id);
    if (currentIndex < cards.length - 1) { setCurrentIndex(currentIndex + 1); setIsFlipped(false); } 
    else { setStudyMode(false); alert("Session complete!"); }
  }

  if (!session) return <Auth />

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '20px' }} className="font-sans">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #334155', marginBottom: '40px' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>FlashForge<span style={{ color: '#6366f1' }}>.</span></h1>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} style={{ padding: '8px 16px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer' }}>SIGN OUT</button>
          </div>
        </header>

        {!studyMode ? (
          <div>
            {/* Upload Section */}
            <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '16px', marginBottom: '40px', border: '1px solid #334155' }}>
              <h2 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase' }}>New Collection</h2>
              <form onSubmit={handleUpload} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} style={{ flexGrow: 1 }} />
                <button disabled={loading || !file} style={{ padding: '12px 24px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: (loading || !file) ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: (loading || !file) ? 0.7 : 1 }}>
                  {loading ? loadingMessages[loadingStep] : 'Create Deck'}
                </button>
              </form>
              {error && (
                <div style={{ marginTop: '15px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
                  <p style={{ color: '#ef4444', fontSize: '12px', margin: 0, fontWeight: 'bold' }}>{error}</p>
                </div>
              )}
            </div>

            {/* Library Section */}
            <div>
              <h2 style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' }}>Your Library</h2>
              {savedDecks.length === 0 && <p style={{ color: '#94a3b8', fontSize: '14px' }}>No decks found. Upload a PDF to begin.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {savedDecks.map(deck => (
                  <div key={deck.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => startStudySession(deck.id)}>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{deck.name}</h3>
                      <p style={{ margin: '5px 0 0 0', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Added {new Date(deck.created_at).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => startStudySession(deck.id)} style={{ padding: '8px 16px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>STUDY</button>
                      <button onClick={() => deleteDeck(deck.id)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>DELETE</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Focused Study Mode */
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            
            {/* Top Navigation: Edit, Delete, Back */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button onClick={() => setStudyMode(false)} style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>← Close Session</button>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => { setIsEditing(true); setEditFront(cards[currentIndex].front); setEditBack(cards[currentIndex].back); }} style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>EDIT</button>
                <button onClick={deleteCurrentCard} style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>DELETE</button>
              </div>
            </div>

            {isEditing ? (
              <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '16px', border: '1px solid #334155' }}>
                <textarea style={{ width: '100%', padding: '15px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', marginBottom: '15px' }} value={editFront} onChange={e => setEditFront(e.target.value)} rows="3" />
                <textarea style={{ width: '100%', padding: '15px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', marginBottom: '15px' }} value={editBack} onChange={e => setEditBack(e.target.value)} rows="3" />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={saveCardEdit} style={{ flex: 1, padding: '12px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                  <button onClick={() => setIsEditing(false)} style={{ padding: '12px 24px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div 
                style={{ minHeight: '350px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => !isFlipped && setIsFlipped(true)}
              >
                <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: isFlipped ? '#10b981' : '#6366f1', marginBottom: '20px', letterSpacing: '2px' }}>
                  {isFlipped ? 'Answer' : `Recall ${currentIndex + 1} / ${cards.length}`}
                </span>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, lineHeight: '1.4' }}>
                  {isFlipped ? cards[currentIndex]?.back : cards[currentIndex]?.front}
                </p>
                {!isFlipped && <p style={{ marginTop: '40px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Tap to Reveal</p>}
              </div>
            )}

            {/* Rating Buttons: Colored & Formatted */}
            {isFlipped && !isEditing && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                {[{l:'Again', v:0, c:'#ef4444'}, {l:'Hard', v:2, c:'#f97316'}, {l:'Good', v:4, c:'#6366f1'}, {l:'Easy', v:5, c:'#10b981'}].map(b => (
                  <button 
                    key={b.l} 
                    onClick={() => handleRating(b.v)} 
                    style={{ flex: '1 1 20%', padding: '16px 10px', backgroundColor: '#1e293b', color: b.c, border: `1px solid ${b.c}`, borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    {b.l}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App