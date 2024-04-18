import { useEffect, useRef, useState } from 'react';
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
import { useCacheStore } from '../utils/zustand/useCacheStore';
import { useGMStore } from '../utils/zustand/useGMStore';
import { FaCrown } from "react-icons/fa6";
import { LuAlarmClock } from "react-icons/lu";

export function Game() {

    const { id } = useParams();
    const { fade, setFading } = useTransitionStore();
    const { account, skin } = useAccountStore();
    const { caches, setCaches } = useCacheStore();

    const { host_id, current_players, setScore, force } = useGMStore();

    const container = useRef<HTMLDivElement | null>(null);
    const ui = useRef<HTMLDivElement | null>(null);

    const { camera, scene, system, renderer, world, hitboxRef, keyPressed, isReady, screenSize, isStop, exit, init, stop } = useGame({ container: container.current!, ui: ui.current! });

    const [spotlightHolder, setSpotlightHolder] = useState<string>('');
    const [currentDate, setCurrentDate] = useState<{ start_date: number, elapsed_date: number }>({ start_date: 0, elapsed_date: 0 });
    const [countdown, setCountdown] = useState<number>(60);
    useEffect(() => {
        if (container.current && ui.current)
            init(true);
    }, [container.current, ui.current])

    // add script here
    const counted = useRef<boolean>(false);
    useEffect(() => {
        if (counted.current)
            return;
        if (!isReady)
            return;
        counted.current = true;

        let ground = createEntity('ground');
        insertComponent(ground, {
            id: 'transform',
            y: -0.5,
            offset: { x: 0.75, y: 0, z: -0.45 }
        });
        insertComponent(ground, {
            id: 'model',
            bucket: 'scenes',
            file: 'GameMap/camp.glb',
            scale: { x: 3.60, y: 3.60, z: 3.60 }
        });
        insertComponent(ground, {
            id: 'hitbox',
            width: 7.5,
            height: 0.1,
            depth: 4.5
        });
        insertEntityToSystem(ground, system, scene, world, ui.current!, hitboxRef, setCaches, caches);

        let spotlight = createEntity('spotlight');
        insertComponent(spotlight, { id: 'type', name: 'spotlight' });
        insertComponent(spotlight, {
            id: 'transform',
            x: 0, y: 0, z: 0,
            offset: { x: 0, y: 0.45, z: 0 }
        });
        insertComponent(spotlight, {
            id: 'spotlight',
            color: 0xFDD837,
            beam_color1: 0xFEB68F,
            beam_color2: 0xF9F4D9,
            intensity: 3,
            distance: 3.5
        });
        insertEntityToSystem(spotlight, system, scene, world, ui.current!, hitboxRef, setCaches, caches);

        setFading(false, '');
    }, [isReady])

    const room = useRef<RealtimeChannel | null>(null);
    useEffect(() => {
        if (!renderer)
            return;
        if (!isReady)
            return;

        if (isStop)
            renderer.setAnimationLoop(null);
        else
            renderer.setAnimationLoop((time) => updateGame(time, scene, world, renderer, system, hitboxRef, keyPressed, camera, screenSize, room.current!))
    }, [isReady, scene, world, renderer, system, keyPressed, camera, screenSize, isStop])

    const [players, setPlayers] = useState<Record<string, any>>({});
    const [scores, setScores] = useState<Record<string, number>>({});
    useEffect(() => {
        if (!isReady)
            return;
        if (isStop)
            return;
        const interval_id = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 0) {
                    if (host_id === account.user_id) {
                        room.current!.send({
                            type: 'broadcast',
                            event: 'end',
                        });
                        if (room.current) {
                            room.current.untrack();
                            room.current.unsubscribe();
                        }
                        setHasEnd(true);
                    }
                    clearInterval(interval_id)
                    return prev;
                } else {
                    return prev - 1;
                }
            });
            let score_dict = scores;
            Object.keys(players).forEach((client_id) => {
                let entity = system[client_id];
                if (entity) {
                    let score = entity.components['score'];
                    if (score) {
                        score_dict[client_id] = Math.floor(score.score);
                    }
                }
            });
            setScores({ ...score_dict });
        }, 1000);

        return () => {
            clearInterval(interval_id)
        }
    }, [isReady, players, isStop])
    useEffect(() => {
        if (currentDate.start_date === 0 || currentDate.elapsed_date === 0)
            return;
        const milliseconds = currentDate.elapsed_date - currentDate.start_date;
        setCountdown((prev) => prev - Math.floor(milliseconds / 1000));
    }, [currentDate])
    const [hasEnd, setHasEnd] = useState<boolean>(false);
    useEffect(() => {
        if (hasEnd) {
            stop(true);
            exit();
            setScore(scores[account.user_id]);
            setFading(true, `/summary/${id}`);
        }
    }, [hasEnd])
    const joinCount = useRef<number>(0);
    useEffect(() => {
        if (!isReady)
            return;
        if (!id)
            return;
        if (fade)
            return;
        if (room.current)
            return;

        room.current = supabase.channel(`game_${id}`, {
            config: {
                broadcast: { self: true },
                presence: {
                    key: account.user_id
                },
            },
        });

        stop(true);
        room.current
            .on('presence', { event: 'sync' }, async () => {
                const new_state = room.current!.presenceState();
                let dict: typeof players = {};
                let score_dict: typeof scores = {};
                let new_state_dict = Object.entries(new_state);
                new_state_dict.forEach(([client, data]) => {
                    dict[client] = data[0];
                    score_dict[client] = 0;
                })
                setPlayers(dict);
                setScores(score_dict);
            })
            .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
                joinCount.current++;
                let player = createEntity(key);
                insertComponent(player, { id: 'type', name: 'player' });
                insertComponent(player, { id: 'transform', y: 0.5 });
                insertComponent(player, {
                    id: 'model',
                    bucket: 'characters',
                    file: `players/${newPresences[0].skin}`,
                    animation: {
                        ['walk']: 0
                    },
                    default_animation: 'walk',
                    scale: { x: 0.001, y: 0.001, z: 0.001 }
                })
                insertComponent(player, {
                    id: 'hitbox',
                    width: 0.25,
                    height: 0.3,
                    depth: 0.25
                });
                insertComponent(player, {
                    id: 'text',
                    text: newPresences[0].username,
                    y: 0.22,
                    size: 12,
                    color: '#ffffff'
                });
                insertComponent(player, { id: 'score', score: 0, trigger: false });
                if (key === account.user_id) {
                    insertComponent(player, { id: 'collision', force: newPresences[0].force });
                    insertComponent(player, { id: 'physic', static: true, apply_force: true });
                    insertComponent(player, { id: 'controller2' });
                    insertComponent(player, { id: 'camera2' });
                    insertComponent(player, { id: 'sync' });
                    insertComponent(player, {
                        id: 'death',
                        onDeath: 'transfer_spotlight'
                    });
                }
                if (newPresences[0].is_host) {
                    setSpotlightHolder(key);
                    const spotlight = system['spotlight'];
                    spotlight.components['spotlight'].follow_id = key;
                    player.components['score'].trigger = true;
                    if (key === account.user_id){
                        player.components['controller2'].max_cooldown = 120;
                    }
                }
                await insertEntityToSystem(player, system, scene, world, ui.current!, hitboxRef, setCaches, caches);

                if (joinCount.current === current_players) {
                    stop(false);
                    if (host_id === account.user_id) {
                        let current_date = Date.now();
                        setCurrentDate({ start_date: current_date, elapsed_date: current_date });
                        room.current!.send({
                            type: 'broadcast',
                            event: 'start',
                            payload: {
                                time: current_date
                            }
                        })
                    }
                }
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                joinCount.current--;
                let entity = system[key];
                if (!entity)
                    return;
                scene.remove(entity.gameObject.model);
                world.removeBody(entity.gameObject.hitbox);
                if (entity.gameObject.text) {
                    entity.gameObject.text.remove();
                }
                delete system[key];
            })
            .on(
                'broadcast',
                { event: 'start' },
                (data) => {
                    setCurrentDate({ start_date: data.payload.time, elapsed_date: Date.now() });
                }
            )
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
                    self_transform.rotate_x = transform.rotation.x;
                    self_transform.rotate_y = transform.rotation.y;
                    self_transform.rotate_z = transform.rotation.z;
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
            .on(
                'broadcast',
                { event: 'tr_spot' },
                (data) => {
                    let entity_id = data.payload.id;
                    const entity = system[entity_id];
                    if (entity) {
                        const score = entity.components['score'];
                        if (score) {
                            score.trigger = true;
                        }
                        const controller2 = entity.components['controller2'];
                        if (controller2)
                            controller2.max_cooldown = 120;
                    }
                    const prev_entity = system[data.payload.prev];
                    if (prev_entity) {
                        const prev_score = prev_entity.components['score'];
                        if (prev_score) {
                            prev_score.trigger = false;
                            prev_score.score = data.payload.score;
                        }
                    }

                    setSpotlightHolder(entity_id);
                    const spotlight = system['spotlight'];
                    if (spotlight)
                        spotlight.components['spotlight'].follow_id = entity_id;
                }
            )
            .on(
                'broadcast',
                { event: 'k' },
                (data) => {
                    let entity_id = data.payload.id;
                    if (account.user_id !== entity_id)
                        return;
                    let entity = system[entity_id];
                    if (!entity)
                        return;
                    const transform = entity.components['transform'];
                    if (!transform)
                        return;
                    let new_position = {
                        x: data.payload.x * 4,
                        y: data.payload.y * 4,
                        z: data.payload.z * 4
                    }
                    let hitbox = system[entity_id].gameObject.hitbox as CANNON.Body;
                    hitbox.position.set(hitbox.position.x + new_position.x, hitbox.position.y + new_position.y, hitbox.position.z + new_position.z);
                    transform.time_rotate = 0;
                    transform.x += new_position.x;
                    transform.y += new_position.y;
                    transform.z += new_position.z;

                    const death = entity.components['death'];
                    if (!death)
                        return;
                    death.killed_by = data.payload.from;
                }
            )
            .on(
                'broadcast',
                { event: 'end' },
                () => {
                    if (room.current) {
                        room.current.untrack();
                        room.current.unsubscribe();
                    }
                    setHasEnd(true);
                }
            )
            .subscribe(async (status) => {
                if (status !== 'SUBSCRIBED')
                    return;

                // initial
                let _skin = skin;
                if (!_skin)
                    _skin = 'knight1-animated.glb';
                await room.current!.track({
                    username: account.username,
                    skin: _skin,
                    is_host: host_id === account.user_id ? true : false,
                    force: force
                });
            });

        return () => {
            if (room.current) {
                room.current.untrack();
                room.current.unsubscribe();
            }
        }
    }, [isReady, fade])

    return (
        <div className=" relative w-full h-full bg-[#84a6c9] flex justify-center items-center">

            <div className='z-20 w-full h-full pointer-events-none p-2 flex justify-between items-start'>
                <div className='flex flex-col justify-start items-start bg-zinc-800 w-fit bg-opacity-60 text-sm'>
                    {
                        Object.entries(players).map(([user_id, player], index) => {
                            return (
                                <div key={`player-${index}`} className=' p-2 text-white flex justify-center items-center gap-2'>
                                    {
                                        spotlightHolder === user_id ?
                                            <FaCrown /> : <></>
                                    }
                                    <p>{player.username}</p>
                                    <p className=' font-mono'>
                                        {scores[user_id]}
                                    </p>
                                </div>
                            )
                        })
                    }
                </div>
                <div className=' w-fit p-2 text-white text-3xl font-mono inline-flex justify-center items-center gap-2'>
                    <LuAlarmClock className=' text-2xl' />
                    <p>{countdown}</p>
                </div>
            </div>

            <GameUILayer forwardedRef={ui} width={screenSize.width} height={screenSize.height} />
            <GameContainerLayer forwardRef={container} />
        </div>
    )
}