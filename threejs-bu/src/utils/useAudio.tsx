import { useEffect, useRef } from "react";
import { downloadFile } from "./gameInitFunctions";




export function useAudio(props: { bucket: string, file: string }) {


    const audio = useRef<HTMLAudioElement | null>(null);
    const initialized = useRef<boolean>(false);
    useEffect(() => {
        if (!props.bucket)
            return;
        if (!props.file)
            return;
        if (audio.current)
            return;
        if (initialized.current)
            return;
        initialized.current = true;

        const f = async () => {
            console.log(props)
            let blob = await downloadFile(props.bucket, props.file);
            console.log(blob)
            if (blob) {
                audio.current = new Audio();
                const url = URL.createObjectURL(blob);
                audio.current.src = url;
                audio.current.play();
            }
        };
        f();

        return () => {
            if (audio.current)
                audio.current.remove();
        }
    }, [props.bucket, props.file])

    return ({
        audio: audio.current
    })
}