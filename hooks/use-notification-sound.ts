import { useRef } from 'react';

export function useNotificationSound(enabled: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = () => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      // Usar Web Audio API para um beep simples
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Erro ao tocar som de notificação:', error);
    }
  };

  return { playSound };
}