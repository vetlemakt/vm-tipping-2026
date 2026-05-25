import { useState, useEffect } from 'react';
import { getResults, updateUser } from './firebase';
import { GROUP_MATCHES, FLAGS, SPEC_FIELDS } from './constants';
import { C } from './styles';

const Flag = ({ team }) => <span style={{fontSize: '1.2rem'}}>{FLAGS[team] || '🏳️'}</span>;

export default function TipsForm({ me, phase }) {
  const [myTips, setMyTips] = useState(me.tips || {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // State for å holde på ID-en til inputfeltet som pulserer akkurat nå
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
    } catch (error) {
      setMessage('❌ Noe gikk galt under lagring.');
    }
    setSaving(false);
  };

  // Sekvensiell pulseringseffekt som kjører 3 runder over tomme felt
  useEffect(() => {
    const emptyFields = [];

    // 1. Sjekk spesialtips (f.eks. champion, runnerUp...)
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

    // 2. Sjekk gruppekamper kronologisk (venstre til høyre, ovenfra og ned)
    GROUP_MATCHES.forEach(match => {
      const matchTip = myTips[match.id];
      if (matchTip?.h === undefined || matchTip?.h === '') {
        emptyFields.push({ id: `${match.id}-h` });
      }
      if (matchTip?.a === undefined || matchTip?.a === '') {
        emptyFields.push({ id: `${match.id}-a` });
      }
    });

    if (emptyFields.length === 0) return;

    let loopCount = 0;
    let currentIndex = 0;
    let timer = null;

    const performPulse = () => {
      if (loopCount >= 3) {
        setActivePulseField(null); // Slå av etter 3 fulle runder
        return;
      }

      const current = emptyFields[currentIndex];
      setActivePulseField(current.id);

      // Bytter til neste tomme felt etter 600ms
      timer = setTimeout(() => {
        currentIndex++;
        if (currentIndex >= emptyFields.length) {
          currentIndex = 0;
          loopCount++;
        }
        performPulse();
      }, 600);
    };

    performPulse();

    return () => clearTimeout(timer);
  }, []); // Kjører kun én gang ved innlasting

  // Funksjon for å gi pulserende ramme- og skyggestiler
  const getPulseStyle = (fieldId, extraStyles = {}) => {
    const isPulsering = activePulseField === fieldId;
    return {
      ...extraStyles,
      border: isPulsering ? '2px solid #FFD700' : extraStyles.border || '1px solid #cbd5e1',
      boxShadow: isPulsering ? '0 0 14px rgba(255, 215, 0, 0.9)' : 'none',
      transition: 'all 0.25s ease-in-out',
    };
  };

  const specFieldsList = SPEC_FIELDS || [
    { key: 'champion', label: '🥇 Verdensmester' },
    { key: 'runnerUp', label: '🥈 Sølvvinner' },
    { key: 'topScorer', label: '⚽ Toppscorer' }
  ];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 80 }}>
      <h2 style={{ textAlign: 'center', color: '#FFD700', marginBottom: 20 }}>Dine Tips</h2>
      
      {message && <div style={{ ...C.botBanner, textAlign: 'center' }}>{message}</div>}

      {/* Seksjon for Spesialtips (Verdensmester osv.) */}
      <div style={{ marginBottom: 30, background: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ fontSize: 16, marginBottom: 12, color: '#FFD700' }}>Spesialtips</h3>
        {specFieldsList.map((field) => (
          <div key={field.key} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#cbd5e1' }}>{field.label}</label>
            <input
              type="text"
              placeholder="Skriv ditt tips..."
              value={myTips[field.key] || ''}
              onChange={(e) => handleSpecialChange(field.key, e.target.value)}
              style={getPulseStyle(field.key, {
                width: '100%',
                padding: '10px',
                borderRadius: 8,
                fontSize: 14,
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                outline: 'none'
              })}
            />
          </div>
        ))}
      </div>

      {/* Grupper og Kamper */}
      {Object.entries(groupedMatches).map(([group, matches]) => (
        <div key={group} style={{ marginBottom: 30, background: 'rgba(255,255,255,0.02)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ background: '#1e40af', color: 'white', padding: '10px 15px', fontWeight: 'bold' }}>
            Gruppe {group}
          </div>
          <div style={{ padding: 10 }}>
            {matches.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <span>{m.t1}</span>
                  <Flag team={m.t1} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 15px' }}>
                  <input
                    type="number"
                    min="0"
                    value={myTips[m.id]?.h ?? ''}
                    onChange={(e) => handleScoreChange(m.id, 'h', e.target.value)}
                    style={getPulseStyle(`${m.id}-h`, {
                      width: 40,
                      height: 40,
                      textAlign: 'center',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 18,
                      background: 'rgba(0,0,0,0.2)',
                      color: '#fff',
                      outline: 'none'
                    })}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>
                  <input
                    type="number"
                    min="