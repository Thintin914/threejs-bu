import { create } from 'zustand'

interface TransitionState {
    fade: boolean;
    navigate: string;
    setFading: (fade: boolean, navigate: string) => void;
    
    audio_bucket: string;
    audio_file: string;
    setAudio: (audio_bucket: string, audio_file: string) => void;
}

export const useTransitionStore = create<TransitionState>()((set) => ({
    fade: false,
    navigate: '',
    audio_bucket: '',
    audio_file: '',
    setFading: (_fade, _navigate) =>{
        set(() => ({
            fade: _fade,
            navigate: _navigate
        }))
    },
    setAudio: (_bucket, _file) =>{
        set(() => ({
            audio_bucket: _bucket,
            audio_file: _file
        }));
    }
}))