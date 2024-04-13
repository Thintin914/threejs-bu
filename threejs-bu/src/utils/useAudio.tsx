import { useEffect, useRef, useState } from "react";
import { downloadFile } from "./gameInitFunctions";
import { useCacheStore } from "./zustand/useCacheStore";

export function useAudio() {

    const {caches, setCaches} = useCacheStore();

    const audio = useRef<HTMLAudioElement | null>(null);
    const [play, setPlay] = useState<boolean>(false);
    const [file, setFile] = useState<{bucket: string, file: string}>({bucket: '', file: ''});
    

    useEffect(() => {
        if (!file.bucket)
            return;
        if (!file.file)
            return;
        if (audio.current){
            URL.revokeObjectURL(audio.current.src);
            audio.current.src = '';
            audio.current.removeAttribute('src');
            audio.current = null;
        }

        let ele = document.getElementById('audio');
        if (!ele)
            return;

        const f = async () => {
            let blob = null;
            if (caches[`${file.bucket}/${file.file}`]){
                console.log('reuse music');
                blob = caches[`${file.bucket}/${file.file}`];
            } else {
                blob = await downloadFile(file.bucket, file.file);
                if (blob)
                    setCaches(`${file.bucket}/${file.file}`, blob);
            }
            if (blob) {
                audio.current = new Audio();
                const url = URL.createObjectURL(blob);
                audio.current.src = url;
                audio.current.autoplay = false;
                audio.current.muted = true;
                ele!.appendChild(audio.current);
            }
        };
        f();
    }, [file])

    useEffect(() =>{
        if (!audio.current)
            return;
        audio.current.currentTime = 0;
        if (play){
            audio.current.muted = false;
            audio.current.loop = true;
            audio.current.play();
        } else {
            audio.current.muted = true;
            audio.current.loop = false;
            audio.current.pause();
        }
    }, [play, audio.current])

    return ({
        audio: audio.current,
        isAudioPlaying: play,
        audioFile: file,
        setAudioPlay: setPlay,
        setAudioFile: setFile
    })
}