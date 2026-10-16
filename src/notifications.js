import {useEffect, useRef, useState} from 'react';

// Compare batches, not whole-order totals: an extra round is a new kitchen ticket.
export function orderNotifications(previous, next, screen) {
  const events = [];
  for (const order of next.orders) {
    const before = previous.orders.find(o => o.id === order.id && o.created === order.created);
    for (const batch of order.batches) {
      const oldBatch = before?.batches.find(b => b.id === batch.id);
      const label = order.type === 'Dine-in' ? `Table ${String(order.table).padStart(2, '0')}` : `Takeaway #${order.id}`;
      if (!oldBatch && screen === 'Kitchen') {
        events.push(`${label} · new kitchen ticket`);
      } else if (oldBatch && oldBatch.status !== batch.status &&
        (screen === 'Kitchen' || (screen === 'Waiter' && order.type === 'Dine-in' && !order.closed))) {
        events.push(`${label} · ${batch.status === 'Ready' ? (order.type === 'Dine-in' ? 'ready to serve' : 'ready for handover') : batch.status.toLowerCase()}`);
      }
    }
  }
  return events;
}

export function useOrderNotifications(state, screen, notify) {
  const previous = useRef(state);
  const audio = useRef(null);
  const enabled = useRef(true);
  const [sound, setSound] = useState('waiting');

  async function unlock() {
    if (!enabled.current) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { setSound('unavailable'); return; }
    try {
      audio.current ||= new Audio();
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
    } catch { /* Visual notices still work when the browser cannot play audio. */ }
  }

  useEffect(() => {
    const arm = event => { if (!event.target.closest?.('[data-sound-toggle]')) void unlock(); };
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      void audio.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const events = orderNotifications(previous.current, state, screen);
    previous.current = state;
    if (!events.length) return;
    notify(events.length === 1 ? events[0] : `${events[0]} · +${events.length - 1} more updates`);
    chime();
  }, [state, screen]);

  async function toggleSound() {
    if (sound === 'on') {
      enabled.current = false;
      setSound('muted');
    } else {
      enabled.current = true;
      await unlock();
      chime();
    }
  }
  return {sound, toggleSound};
}
