import { useState, useEffect } from 'react';
import { getResults, updateUser } from './firebase';
import { GROUP_MATCHES, FLAGS, SPEC_FIELDS } from './constants';
import { C } from './styles';

const Flag = ({ team }) => <span style={{fontSize: '1.2rem'}}>{FLAGS[team] || '🏳️'}</span>;

export default function TipsForm({ me }) {
  const [myTips, setMyTips] = useState(me.tips || {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // State for å holde styr på hvilket felt ID som pulserer akkurat nå
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

  // Effekt som kjører den sekvensielle pulseringen nøyaktig 3 ganger på uutfylte felt
  useEffect(() => {
    const emptyFields = [];

    // 1. Legg til tomme spesialtips (Verdensmester, Toppscorer etc) først
    const specFieldsList = SPEC_FIELDS || [
      { key: 'champion', label: '🥇 Verdensmester' },
      { key: 'runnerUp', label: '🥈 Sølvvinner' },
      { key: 'topScorer', label: '⚽ Toppscorer' }
    ];

    specFieldsList.forEach(field => {
      if (!myTips[field.key]) {
        emptyFields.push({ id: field.key });
      }
    });

    // 2. Legg til tomme gruppekamper (fra venstre til høyre i gruppene, og nedover kampene)
    // GROUP_MATCHES er allerede sortert kronologisk/gruppevis (A->B->C... og kamp for kamp)
    GROUP_MATCHES.forEach(match => {
      const matchTip = myTips[match.id];
      if (matchTip?.h === undefined || matchTip?.h === '') {
        emptyFields.push({ id: `${match.id}-h` });
      }
      if (matchTip?.a === undefined || matchTip?.a === '') {
        emptyFields.push({ id: `${match.id}-a` });
      }
    });

    // Hvis alle felt er ferdig utfylt, gjør vi ingenting
    if (emptyFields.length === 0) return;

    let loopCount = 0;
    let currentIndex = 0;
    let timer = null;

    const performPulse = () => {
      if (loopCount >= 3) {
        setActivePulseField(null); // Slå av effekten etter 3 runder
        return;
      }

      const current = emptyFields[currentIndex];
      setActivePulseField(current.id);

      // Gå raskt videre til neste tomme felt (600ms gir en fin, kvikk puls)
      timer = setTimeout(() => {
        currentIndex++;
        if (currentIndex >= emptyFields.length) {
          currentIndex = 0;
          loopCount++;
        }
        performPulse();
      }, 600);
    };

    // Start animasjonsekvensen
    performPulse();

    // Rydd opp timeren hvis komponenten demonteres under pulseringen
    return () => clearTimeout(timer);
  }, []);

  // Hjelpefunksjon for å hente den pulserende stilen dynamisk
  const getInputPulseStyle = (fieldId, baseStyle = {}) => {
    const isPulsering = activePulseField === fieldId;
    return {
      ...baseStyle,
      border: isPulsering ? '2px solid #FFD700' : baseStyle.border || '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: isPulsering ? '0 0 14px rgba(255, 215, 0, 0.85)' : 'none',
      transition: 'all 0.25s ease-in-out',
    };
  };

  const specFieldsList = SPEC_FIELDS || [
    { key: 'champion', label: '🥇 Verdensmester' },
    { key: 'runnerUp', label: '🥈 Sølvvinner' },
    { key: 'topScorer', label: '⚽ Toppscorer' }
  ];

  return (
    <div className="fu" style={{ ...C.card, padding: '16px 20px 40px', maxWidth: 650, margin: '0 auto', marginBottom: 100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#FFD700', marginBottom: 16, textAlign: 'center', letterSpacing: 0.5 }}>
        ✏️ LEVER DINE TIPS
      </h2>

      {message && (
        <div style={{ ...C.botBanner, textAlign: 'center', margin: '0 auto 16px', background: 'rgba(5, 150, 105, 0.15)', borderColor: '#059669', color: '#34d399' }}>
          {message}
        </div>
      )}

      {/* Seksjon for Spesialtips (Verdensmester, Toppscorer osv.) */}
      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, color: 'rgba(255,215,0,0.8)', marginBottom: 12, fontWeight: 600, borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: 4 }}>
          Spesialtips
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {specFieldsList.map((field) => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>{field.label}</label>
              <input
                type="text"
                placeholder={`Velg ditt tips for ${field.label.toLowerCase()}...`}
                value={myTips[field.key] || ''}
                onChange={(e) => handleSpecialChange(field.key, e.target.value)}
                style={getInputPulseStyle(field.key, {
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  color: '#e8edf8',
                  fontSize: 14,
                  border: '1px solid rgba(255,255,255,0.15)',
                  outline: 'none'
                })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Grupper og Kamper */}
      {Object.keys(groupedMatches).sort().map((group) => (
        <div key={group} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, color: '#FFD700', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: 4, marginBottom: 12, fontWeight: 600 }}>
            Gruppe {group}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groupedMatches[group].map((m) => (
              <div 
                key={m.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  padding: '10px 12px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.04)', 
                  borderRadius: 8 
                }}
              >
                <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  <span>{m.t1}</span> <Flag team={m.t1} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 12px' }}>
                  <input
                    type="number"
                    min="0"
                    value={myTips[m.id]?.h ?? ''}
                    onChange={(e) => handleScoreChange(m.id, 'h', e.target.value)}
                    style={getInputPulseStyle(`${m.id}-h`, {
                      width: 40,
                      height: 40,
                      textAlign: 'center',
                      borderRadius: 6,
                      background: 'rgba(0,0,0,0.2)',
                      color: '#e8edf8',
                      fontSize: 18,
                      border: '1px solid #cbd5e1',
                      outline: 'none'
                    })}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>-</span>
                  <input
                    type="number"
                    min="0"
                    value={myTips[m.id]?.a ?? ''}
                    onChange={(e) => handleScoreChange(m.id, 'a', e.target.value)}
                    style={getInputPulseStyle(`${m.id}-a`, {
                      width: 40,
                      height: 40,
                      textAlign: 'center',
                      borderRadius: 6,
                      background: 'rgba(0,0,0,0.2)',
                      color: '#e8edf8',
                      fontSize: 18,
                      border: '1px solid #cbd5e1',
                      outline: 'none'
                    })}
                  />
                </div>

                <div style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Flag team={m.t2} /> <span>{m.t2}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Flytende lagre-knapp nederst */}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 400, zIndex: 999 }}>
        <button 
          onClick={saveTips}
          disabled={saving}
          style={{ 
            width: '100%', padding: '15px', borderRadius: 12, border: 'none', 
            background: '#059669', color: 'white', fontWeight: 'bold', fontSize: 16,
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)', cursor: 'pointer',
            transition: 'transform 0.1s'
          }}
        >
          {saving ? 'Lagrer...' : 'Lagre Tips'}
        </button>
      </div>
    </div>
  );
}
