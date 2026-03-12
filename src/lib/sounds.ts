// Singleton AudioContext — browsers block new AudioContext until a user gesture
let _audioCtx: AudioContext | null = null;

export const resumeAudioContext = async (): Promise<AudioContext | null> => {
    if (typeof window === 'undefined') return null;
    try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return null;
        if (!_audioCtx) _audioCtx = new AudioContextClass();
        if (_audioCtx && _audioCtx.state === 'suspended') {
            await _audioCtx.resume();
        }
        return _audioCtx;
    } catch {
        return null;
    }
};

// Call this on first user interaction to unlock audio early
export const unlockAudio = () => {
    resumeAudioContext().catch(() => {});
};

export const playSoundEffect = async (type: 'tick' | 'ding' | 'fail' | 'success' | 'gartic-ring' | 'count' | 'ranking') => {
    if (typeof window === 'undefined') return;

    // Handle MP3 sounds separately
    if (type === 'gartic-ring') {
        const audio = new Audio('/sounds/garticohone-ring.mp3');
        audio.volume = 0.4;
        audio.play().catch(e => console.error("Error playing gartic-ring:", e));
        return;
    }

    const ctx = await resumeAudioContext();
    if (!ctx) return;

    try {
        const playOscillator = (freq: number, oscType: OscillatorType, duration: number, vol: number = 0.1) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = oscType;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        };

        switch (type) {
            case 'tick':
                playOscillator(800, 'square', 0.05, 0.05);
                break;
            case 'ding':
                playOscillator(1200, 'sine', 0.3, 0.1);
                setTimeout(() => playOscillator(1600, 'sine', 0.4, 0.1), 50);
                break;
            case 'success':
                playOscillator(440, 'sine', 0.5, 0.1);
                playOscillator(554, 'sine', 0.5, 0.1);
                playOscillator(659, 'sine', 0.5, 0.1);
                setTimeout(() => {
                    playOscillator(554, 'sine', 0.6, 0.1);
                    playOscillator(659, 'sine', 0.6, 0.1);
                    playOscillator(880, 'sine', 0.6, 0.1);
                }, 150);
                break;
            case 'count':
                playOscillator(600, 'sine', 0.1, 0.05);
                break;
            case 'ranking':
                playOscillator(523.25, 'sine', 0.2, 0.1); // C5
                setTimeout(() => playOscillator(659.25, 'sine', 0.2, 0.1), 100); // E5
                setTimeout(() => playOscillator(783.99, 'sine', 0.2, 0.1), 200); // G5
                setTimeout(() => playOscillator(1046.50, 'sine', 0.4, 0.1), 300); // C6
                break;
            case 'fail': {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
                break;
            }
        }
    } catch (e) {
        console.error("Audio playback error:", e);
    }
};
