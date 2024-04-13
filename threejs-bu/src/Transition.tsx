import { motion, useAnimate } from "framer-motion";
import { useEffect, useRef } from "react";
import { useTransitionStore } from "./utils/zustand/useTransitionStore";
import { useNavigate } from "react-router-dom";
import { GiDeathSkull } from "react-icons/gi";
import { useAudio } from "./utils/useAudio";



export function Transition(){

    const [slideScope, slideAnimate] = useAnimate();

    const {fade, navigate, audio_bucket, audio_file} = useTransitionStore();

    const navigateFunction = useNavigate();

    const {audio, audioFile, isAudioPlaying, setAudioFile, setAudioPlay} = useAudio();
    const audioDiv = useRef<HTMLDivElement | null>(null);

    async function SlideCover(){
        slideScope.current.style.display = 'flex';
        await slideAnimate(slideScope.current, {x: -window.innerWidth}, {duration: 0});
        await slideAnimate(slideScope.current, {x: 0}, {ease: 'easeInOut', duration: 1});
        if (navigate !== ''){
            navigateFunction(navigate);
        }
    }

    async function SlideOut(){
        slideScope.current.style.display = 'flex';
        await slideAnimate(slideScope.current, {x: window.innerWidth}, {ease: 'easeInOut', duration: 1});
        slideScope.current.style.display = 'none';
    }

    useEffect(() =>{
        if (audioDiv.current)
            return;

        let ele = document.getElementById('audio');
        if (ele){
            audioDiv.current = ele as HTMLDivElement;
        }
    }, [])

    useEffect(() =>{
        if (!slideScope.current)
            return;

        if (fade){
            SlideCover();
        } else {
            SlideOut();
        }
    }, [slideScope.current, fade])

    useEffect(() =>{
        if (audioFile.bucket === audio_bucket && audioFile.file === audio_file)
            return;
        setAudioPlay(false);
        if (audioDiv.current){
            Object.values(audioDiv.current.children).forEach((child) =>{
                let typed_child = child as HTMLAudioElement;
                typed_child.pause();
                URL.revokeObjectURL(typed_child.src);
                typed_child.src = '';
                typed_child.removeAttribute('src');
                audioDiv.current!.removeChild(child);
            });
        }
        setAudioFile({
            bucket: audio_bucket,
            file: audio_file
        });
        setAudioPlay(true);

    }, [audio_bucket, audio_file])

    return (
        <motion.div ref={slideScope} className=" z-50 absolute text-white w-full h-full bg-[#9cbada] select-none justify-center items-center"
            style={{
                display: 'none'
            }}
            initial={{x: -window.innerWidth}}
        >
            <GiDeathSkull className=" text-9xl" />
        </motion.div> 
    )
}