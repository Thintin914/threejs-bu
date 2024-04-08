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
import * as CANNON from 'cannon-es'

export function Game(){

    const {id} = useParams();
    const {setFading} = useTransitionStore();
    const {account, skin} = useAccountStore();

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

    const room = useRef<RealtimeChannel | null>(null);
    useEffect(() =>{
        if (!renderer)
            return;
        if (!isReady)
            return;
        
        if (isStop)
            renderer.setAnimationLoop(null);
        else
            renderer.setAnimationLoop(() => updateGame(scene, world, renderer, system, keyPressed, camera, screenSize, room.current!))
    }, [isReady, scene, world, renderer, system, keyPressed, camera, screenSize, isStop])

    const [players, setPlayers] = useState<Record<string, any>>({});
    useEffect(() =>{
        if (!isReady)
            return;
        if (!id)
            return;
        if (room.current)
            return;

        room.current = supabase.channel(`game_${id}`, {
            config: {
                broadcast: { self: false },
                presence: {
                    key: account.user_id
                },
            },
        });

        room.current
        .on('presence', { event: 'sync' }, async() => {
            const new_state = room.current!.presenceState();
            let dict: typeof players = {};
            let new_state_dict = Object.entries(new_state);
            new_state_dict.forEach(([client, data]) =>{
                dict[client] = data[0];
                setPlayers(dict);
            })
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
            stop(true);
            let player = createEntity(key);
            insertComponent(player, {id: 'transform', y: 0.5});
            insertComponent(player, {
                id: 'model',
                bucket: 'characters',
                file: `players/${newPresences[0].skin}`,
                scale: {x: 0.001, y: 0.001, z: 0.001}
            })
            insertComponent(player, {
                id: 'hitbox',
                width: 0.1,
                height: 0.1,
                depth: 0.1
            });
            insertComponent(player, {
                id: 'text',
                text: newPresences[0].username,
                y: 0.22,
                size: 12,
                color: '#ffffff'
            });
            if (key === account.user_id){
                insertComponent(player, {id: 'physic', static: true});
                insertComponent(player, {id: 'controller'});
                insertComponent(player, {id: 'camera'});
                insertComponent(player, {id: 'sync'});
            }
            await insertEntityToSystem(player, system, scene, world, ui.current!);
            stop(false);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            let entity = system[key];
            if (!entity)
                return;
            scene.remove(entity.gameObject.model);
            world.removeBody(entity.gameObject.hitbox);
            if (entity.gameObject.text){
                entity.gameObject.text.remove();
            }
            delete system[key];
        })
        .on(
            'broadcast',
            { event: 't' },
            (data) => {
                let entity_id = data.payload.id;
                if (entity_id === account.user_id)
                    return;
                let entity = system[entity_id];
                if (!entity)
                    return;
                let transform = data.payload.transform;
                let self_transform = entity.components['transform'];
                let hitbox = system[entity_id].gameObject.hitbox as CANNON.Body;
                hitbox.position.set(transform.position.x, transform.position.y, transform.position.z);
                self_transform.x = transform.position.x;
                self_transform.y = transform.position.y;
                self_transform.z = transform.position.z;
                hitbox.quaternion.set(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
                self_transform.scale = transform.scale;
            }
        )
        .on(
            'broadcast',
            { event: 'tr' },
            (data) => {
                let entity_id = data.payload.id;
                if (entity_id === account.user_id)
                    return;
                let entity = system[entity_id];
                if (!entity)
                    return;
                entity.components['transform'].time_rotate = 0;
            }
        )
        .subscribe( async(status) =>{
            if (status !== 'SUBSCRIBED')
                return;

            // initial
            await room.current!.track({
                username: account.username,
                skin: skin
            });
        });

        return () =>{
            if (room.current){
                room.current.untrack();
                room.current.unsubscribe();
            }
        }
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