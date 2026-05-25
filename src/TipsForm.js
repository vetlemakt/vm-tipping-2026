import { useState, useEffect } from 'react';
import { getResults, updateUser } from './firebase';
import { GROUP_MATCHES, FLAGS, SPEC_FIELDS } from './constants';
import { C } from './styles';

const Flag = ({ team }) => <span style={{fontSize: '1.2rem'}}>{FLAGS[team] || '🏳️'}</span>;

export default function TipsForm({ me }) {
  const [myTips, setMyTips] = useState(me.tips || {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Tilstand for å holde styr på hvilket felt som pulserer akkurat nå
  const [activePulseField, setActivePulseField] = useState(null);

  // Grupper kampene etter gruppe (A, B, C...)
  const groupedMatches = GROUP_MATCHES.reduce((acc, match) => {
    if (!acc[match.group]) acc[match.group] = [];
    acc[match.group].push(match);
    return acc;
  }, {});

  const handleScoreChange = (matchId, side, value) => {
    const val = value === '' ? '' : parseInt(value, 10);
    setMyTips(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: val
      }
    }));
  };

  const handleSpecialChange = (fieldKey, value) => {
    setMyTips(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const saveTips = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateUser(me.id, { tips: myTips });
      setMessage('✅ Tips lagret!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('❌ Noe gikk galt under lagring.');
    } finally {
      setSaving(false);
    }
  };

  // Effekt for den sekvensielle pulseringen (kjører 3 runder og stopper)
  useEffect(() => {
    const emptyFields = [];

    // 1. Spesialtips (Verdensmester, Toppscorer osv.) i rekkefølge
    if (SPEC_FIELDS && Array.isArray(SPEC_FIELDS)) {
      SPEC_FIELDS.forEach(field => {
        if (!myTips[field.key]) {
          emptyFields.push({ id: field.key });
        }
      });
    } else {
      // Fallback hvis SPEC_FIELDS ikke er lastet ordentlig inn i simuleringen
      const fields = ['champion', 'runnerUp', 'topScorer'];
      fields.forEach(key => {
        if (!myTips[key]) emptyFields.push({ id: key });
      });
    }

    // 2. Gruppekamper sortert fra gruppe A til L (venstre til høyre, deretter nedover)
    // Siden GROUP_MATCHES allerede ligger sortert kronologisk/gruppevis i constants.js,
    // følger vi rekkefølgen direkte her.
    GROUP_MATCHES.forEach(match => {
      if (myTips[match.id]?.h === undefined || myTips[match.id]?.h === '') {
        emptyFields.push({ id: `${match.id}-h` });
      }
      if (myTips[match.id]?.a === undefined || myTips[match.id]?.a === '') {
        emptyFields.push({ id: `${match.id}-a` });
      }
    });

    if (emptyFields.length === 0) return;

    let currentLoop = 0;
    let currentIndex = 0;
    let timer = null;

    const runPulse = () => {
      if (currentLoop >= 3) {
        setActivePulseField(null); // Stopp etter 3 runder
        return;
      }

      const currentField = emptyFields[currentIndex];
      setActivePulseField(currentField.id);

      // Gå raskt videre til neste felt (f.eks. etter 500ms for en kvikk puls)
      timer = setTimeout(() => {
        currentIndex++;
        if (currentIndex >= emptyFields.length) {
          currentIndex = 0;
          currentLoop++;
        }
        runPulse();
      }, 500);
    };

    runPulse();

    return () => clearTimeout(timer);
  }, []); // Kjøres én gang ved mount

  // Helper for å generere pulserende stil dynamisk
  const getPulseStyle = (fieldId) => {
    const isPulsering = activePulseField === fieldId;
    return {
      border: isPulsering ? '2px solid #FFD700' : '1px solid rgba(255, 215, 0, 0.2)',
      boxShadow: isPulsering ? '0 0 14px rgba(255, 215, 0, 0.9)' : 'none',
      transition: 'all 0.25s ease-in-out',
      background: 'rgba(255, 255, 255, 0.05)',
      color: '#e8edf8',
    };
  };

  return (
    <div style={{ ...C.card, padding: 20, marginBottom: 80, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, color: '#FFD700', borderBottom: '1px solid rgba(255,215,0,0.2)', paddingBottom: 8 }}>
        🏆 Dine Tips
      </h2>

      {message && <div style={{ ...C.botBanner, textAlign: 'center', marginBottom: 16 }}>{message}</div>}

      {/* Seksjon for Spesialtips (Verdensmester osv.) */}
      <div style={{ marginBottom: 30, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: 16, marginBottom: 12, color: 'rgba(255,255,255,0.7)' }}>Spesialtips</h3>
        {(SPEC_FIELDS || []).map((field) => (
          <div key={field.key} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#cbd5e1' }}>{field.label}</label>
            <input
              type="text"
              placeholder="Skriv ditt tips..."
              value={myTips[field.key] || ''}
              onChange={(e) => handleSpecialChange(field.key, e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                ...getPulseStyle(field.key)
              }}
            />
          </div>
        ))}
      </div>

      {/* Seksjon for Grupper og Kamper */}
      {Object.keys(groupedMatches).sort().map((group) => (
        <div key={group} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, color: '#FFD700', marginBottom: 12, paddingLeft: 4 }}>
            Gruppe {group}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedMatches[group].map((m) => (
              <div 
                key={m.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: 'rgba(255,255,255,0.03)', 
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  <span>{m.t1}</span> <Flag team={m.t1} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 16px' }}>
                  <input
                    type="number"
                    min="0"
                    value={myTips[m.id]?.h ?? ''}
                    onChange={(e) => handleScoreChange(m.id, 'h', e.target.value)}
                    style={{ 
                      width: 42, 
                      height: 42, 
                      textAlign: 'center', 
                      borderRadius: 8, 
                      fontSize: 18, 
                      fontWeight: 'bold',
                      ...getPulseStyle(`${m.id}-h`)
                    }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}>-</span>
                  <input
                    type="number"
                    min="0"
                    value={myTips[m.id]?.a ?? ''}
                    onChange={(e) => handleScoreChange(m.id, 'a', e.target.value)}
                    style={{ 
                      width: 42, 
                      height: 42, 
                      textAlign: 'center', 
                      borderRadius: 8, 
                      fontSize: 18, 
                      fontWeight: 'bold',
                      ...getPulseStyle(`${m.id}-a`)
                    }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}>
                  <Flag team={m.t2} /> <span>{m.t2}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Flytende lagre-knapp nederst */}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 400, zIndex: 100 }}>
        <button 
          onClick={saveTips}
          disabled={saving}
          style={{ 
            width: '100%', padding: '14px', borderRadius: 12, border: 'none', 
            background: '#059669', color: 'white', fontWeight: 'bold', fontSize: 16,
            boxShadow: '0 4px 16px rgba(5, 150, 105, 0.4)', cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {saving ? 'Lagrer...' : 'Lagre Tips'}
        </button>
      </div>
    </div>
  );
}
