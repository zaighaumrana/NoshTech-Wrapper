import {useEffect, useRef, useState} from 'react';

// Runs on the existing Supabase refreshes; no extra requests or backend changes.
export function orderNotifications(previous, next, role) {
  const before = new Map(previous.map(order => [String(order.id), order]));
  const events = [];
  for (const order of next) {
    const old = before.get(String(order.id));
    const takeaway = order.table_number == null;
    const label = takeaway ? `Takeaway #${order.id}` : `Table ${String(order.table_number).padStart(2, '0')}`;
    const changed = old && old.status !== order.status;
    if (role === 'kitchen' && order.paid_at && ['kitchen_queued', 'preparing', 'ready'].includes(order.status)) {
      if (!old || !old.paid_at || old.status === 'pending_counter') {
        events.push(`${label} · new kitchen ticket`);
      } else if (changed && ['preparing', 'ready'].includes(order.status)) {
        events.push(`${label} · ${order.status === 'ready' ? (takeaway ? 'ready for handover' : 'ready to serve') : 'preparing'}`);
      }
    } else if (role === 'counter' && !old && !takeaway && order.status === 'pending_counter') {
      events.push(`${label} · new order awaiting payment`);
    } else if (changed && order.paid_at && ['preparing', 'ready'].includes(order.status) &&
      ((role === 'waiter' && !takeaway) || (role === 'counter' && takeaway))) {
      events.push(`${label} · ${order.status === 'ready' ? (takeaway ? 'ready for handover' : 'ready to serve') : 'preparing'}`);
    }
  }
  return events;
}

const SOUND_KEY = 'noshtech-notification-sound';
export function useOrderNotifications(snapshot, scope, role, notify) {
  const previous = useRef(null);
  const audio = useRef(null);
  const enabled = useRef(true);
  const [sound, setSound] = useState('waiting');

  async function unlock() {
    if (!enabled.current) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { setSound('unavailable'); return; }
    try {
      if (!audio.current || audio.current.state === 'closed') audio.current = new Audio();
      if (audio.current.state === 'suspended') await audio.current.resume();
      setSound(audio.current.state === 'running' ? 'on' : 'waiting');
    } catch { setSound('waiting'); }
  }

  function chime() {
    const ctx = audio.current;
    if (!enabled.current || !ctx || ctx.state !== 'running') return;
    try {
      [660, 880].forEach((frequency, index) => {
        const start = ctx.currentTime + index * 0.16;
        const tone = ctx.createOscillator();
        const volume = ctx.createGain();
        tone.type = 'sine';
        tone.frequency.value = frequency;
        volume.gain.setValueAtTime(0, start);
        volume.gain.linearRampToValueAtTime(0.12, start + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        tone.connect(volume);
        volume.connect(ctx.destination);
        tone.onended = () => { tone.disconnect(); volume.disconnect(); };
        tone.start(start);
        tone.stop(start + 0.27);
      });
    } catch { /* Visual notices remain available if audio cannot play. */ }
  }

  useEffect(() => {
    try {
      enabled.current = localStorage.getItem(SOUND_KEY) !== 'muted';
      if (!enabled.current) setSound('muted');
    } catch { /* Still works when browser storage is unavailable. */ }
    const arm = event => { if (!event.target.closest?.('[data-sound-toggle]')) void unlock(); };
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      const ctx = audio.current;
      audio.current = null;
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    // First successful sync and account/role changes establish a silent baseline.
    if (!scope || !snapshot || snapshot.scope !== scope) { previous.current = null; return; }
    const old = previous.current;
    previous.current = snapshot;
    if (!old || old.scope !== scope) return;
    const events = orderNotifications(old.orders, snapshot.orders, role);
    if (!events.length) return;
    notify(events.length === 1 ? events[0] : `${events[0]} · +${events.length - 1} more updates`);
    chime();
  }, [snapshot, scope, role]);

  async function toggleSound() {
    if (enabled.current && sound === 'on') {
      enabled.current = false;
      setSound('muted');
    } else {
      enabled.current = true;
      await unlock();
      chime();
    }
    try { localStorage.setItem(SOUND_KEY, enabled.current ? 'on' : 'muted'); } catch {}
  }
  return {sound, toggleSound};
}
