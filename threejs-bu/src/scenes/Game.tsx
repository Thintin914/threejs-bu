import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTransitionStore } from '../utils/zustand/useTransitionStore';
import { useGame } from '../utils/useGame';
import { createEntity, insertComponent, insertEntityToSystem } from '../utils/gameInitFunctions';
import { updateGame } from '../utils/game-cycle/updateGame';
import { GameUILayer } from '../utils/GameUILayer';
import { GameContainerLayer } from '../utils/GameContainerLayer';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '..';
import { useParams } from 'react-router-dom';
import { useAccountStore } from '../utils/zustand/useAccountStore';


export function Game(){

    const {id} = useParams();
    const {setFading} = useTransitionStore();
    const {account} = useAccountStore();

    const container = useRef<HTMLDivElement | null>(null);
    const ui = useRef<HTMLDivElement | null>(null);

    const {camera, scene, system, renderer, world, keyPressed, isReady, screenSize, isStop, exit, init, stop} = useGame({container: container.current!, ui: ui.current!});

    useEffect(() =>{
        if (container.current && ui.current)
            init(true);
    }, [container.current, ui.current])

    // add script here
    const counted = useRef<boolean>(false);
    useEffect(() =>{
        if (counted.current)
            return;
        if (!isReady)
            return;
        counted.current = true; 

        let ground = createEntity('ground');
        insertComponent(ground, {id: 'transform', rotate_x: 0});
        insertComponent(ground, {
            id: 'circle_plane',
            radius: 1,
            segments: 16,
            color: 0xdae1ed
        });
        insertEntityToSystem(ground, system, scene, world, ui.current!);

        setFading(false, '');
    }, [isReady])

    useEffect(() =>{
        if (!renderer)
            return;
        if (!isReady)
            return;
        
        if (isStop)
            renderer.setAnimationLoop(null);
        else
            renderer.setAnimationLoop(() => updateGame(scene, world, renderer, system, keyPressed, camera, screenSize))
    }, [isReady, scene, world, renderer, system, keyPressed, camera, screenSize, isStop])

    const room = useRef<RealtimeChannel | null>(null);
    useEffect(() =>{
        if (!isReady)
            return;
        if (!id)
            return;
        if (room.current)
            return;

        room.current = supabase.channel(`game${id}`, {
            config: {
                broadcast: { self: false },
                presence: {
                    key: account.user_id
                },
            },
        });
    }, [isReady])

    return (
        <div className=" relative w-full h-full bg-[#84a6c9] flex justify-center items-center">
            
            <div className='z-20 w-full h-full flex justify-start items-start pointer-events-none p-2'>
                <motion.div className=" pointer-events-auto text-sm font-semibold p-1 pl-2 pr-2 border-2 border-white rounded-md select-none text-white cursor-pointer"
                initial={{ scale: 1, color: "#ffffff" }}
                whileHover={{ scale: 1.2, color: "#000000" }}
                transition={{
                  type: "spring",
                  bounce: 0.6,
                }}
                whileTap={{ scale: 0.8, rotateZ: 0 }}
                onClick={() =>{
                    exit();
                    setFading(true, '/');
                }}>
                    Back
                </motion.div>
            </div>

            <GameUILayer forwardedRef={ui} width={screenSize.width} height={screenSize.height} />
            <GameContainerLayer forwardRef={container} />
        </div>
    )
}