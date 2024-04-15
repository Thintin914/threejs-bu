import { useEffect, useRef, useState } from 'react';
import { motion, useAnimate } from 'framer-motion';
import { useGame } from '../utils/useGame';
import { createEntity, downloadFile, insertComponent, insertEntityToSystem } from '../utils/gameInitFunctions';
import { updateGame } from '../utils/game-cycle/updateGame';
import { useAccountStore } from '../utils/zustand/useAccountStore';
import { useTransitionStore } from '../utils/zustand/useTransitionStore';
import { GameUILayer } from '../utils/GameUILayer';
import { GameContainerLayer } from '../utils/GameContainerLayer';
import { FaLock } from "react-icons/fa";
import { supabase } from '..';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useGMStore } from '../utils/zustand/useGMStore';
import { useCacheStore } from '../utils/zustand/useCacheStore';

export function Lobby() {

    const { account, setHost } = useAccountStore();
    const { setGMState } = useGMStore();
    const { setFading, setAudio } = useTransitionStore();
    const {caches, setCaches} = useCacheStore();


    const container = useRef<HTMLDivElement | null>(null);
    const ui = useRef<HTMLDivElement | null>(null);

    const { pointLight, camera, scene, system, renderer, world, hitboxRef, keyPressed, isReady, screenSize, isStop, exit, init, stop } = useGame({ container: container.current!, ui: ui.current! });

    useEffect(() => {
        if (container.current && ui.current)
            init(true);
    }, [container.current, ui.current])

    const [openRoomMenu, setOpenRoomMenu] = useState<boolean>(false);

    // add script here
    const counted = useRef<boolean>(false);
    useEffect(() => {
        if (!account.user_id)
            return;
        if (counted.current)
            return;
        if (!isReady)
            return;
        counted.current = true;

    pointLight.color.set(0x8AD1EE);

        const f = async () => {

            let ground = createEntity('ground');
            insertComponent(ground, { id: 'transform' });
            insertComponent(ground, {
                id: 'model',
                bucket: 'scenes',
                file: 'lobby/hall.glb',
                scale: { x: 0.30, y: 0.30, z: 0.30 }
            });
            insertComponent(ground, {
                id: 'hitbox',
                width: 10,
                height: 0.1,
                depth: 10
            });
            await insertEntityToSystem(ground, system, scene, world, ui.current!, hitboxRef, setCaches, caches);

            let player = createEntity('player');
            insertComponent(player, {id: 'type', name: 'player'});
            insertComponent(player, { id: 'transform', y: 0.5 });
            insertComponent(player, {
                id: 'model',
                bucket: 'characters',
                file: 'players/knight1.glb',
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
                text: account.username,
                y: 0.22,
                size: 12,
                color: '#ffffff'
            })
            insertComponent(player, { id: 'physic', static: true });
            insertComponent(player, { id: 'controller' });
            insertComponent(player, { id: 'camera' });
            await insertEntityToSystem(player, system, scene, world, ui.current!, hitboxRef, setCaches, caches);

            let lobby = createEntity('lobby');
            insertComponent(lobby, {
                id: 'transform',
                x: 0, y: 0.45, z: -0.5
            })
            insertComponent(lobby, {
                id: 'box',
                width: 0.3,
                height: 0.1,
                depth: 0.1,
                color: 0x84a6c9
            });
            insertComponent(lobby, { id: 'physic' });
            insertComponent(lobby, {
                id: 'text',
                text: 'Lobby',
                y: 0.15,
                size: 25,
                color: '#ffffff',
                onClick: () => setOpenRoomMenu(openRoomMenu => !openRoomMenu)
            })
            await insertEntityToSystem(lobby, system, scene, world, ui.current!, hitboxRef, setCaches, caches);

            setFading(false, '');
        };
        f();
    }, [isReady])

    useEffect(() => {
        if (!renderer)
            return;
        if (!isReady)
            return;

        if (isStop)
            renderer.setAnimationLoop(null);
        else
            renderer.setAnimationLoop((time) => updateGame(time, scene, world, renderer, system, hitboxRef, keyPressed, camera, screenSize))
    }, [isReady, scene, world, renderer, system, keyPressed, camera, screenSize, isStop])

    const [menuType, setMenuType] = useState<string>('all')
    const [roomMenuScope, roomMenuAnimate] = useAnimate();

    const [roomName, setRoomName] = useState<string>('');
    const [roomPlayers, setRoomPlayers] = useState<any>(2);
    const [password, setPassword] = useState<string>('');

    async function OpenRoomMenuAnimation() {
        roomMenuScope.current.style.display = 'flex';
        roomMenuScope.current.style.opacity = '0';
        await roomMenuAnimate(roomMenuScope.current, { opacity: 1 });
    }

    async function CloseRoomMenuAnimation() {
        roomMenuScope.current.style.display = 'flex';
        roomMenuScope.current.style.opacity = '1';
        await roomMenuAnimate(roomMenuScope.current, { opacity: 0 });
        roomMenuScope.current.style.display = 'none';
    }

    useEffect(() => {

        if (openRoomMenu) {
            stop(true);
            OpenRoomMenuAnimation();
        } else {
            stop(false);
            CloseRoomMenuAnimation();
        }
    }, [openRoomMenu])

    const rooms = useRef<RealtimeChannel | null>(null);
    const [roomItems, setRoomItems] = useState<Record<string, { allowed_players: number, current_players: number, room_id: string, password: string, user_password: string, room_name: string, host_id: string }>>({});
    useEffect(() => {
        if (!isReady)
            return;
        if (!supabase)
            return;
        if (rooms.current)
            return;

        const f = async () => {

            rooms.current = supabase.channel('rooms', {
                config: {
                    presence: {
                        key: account.user_id
                    },
                },
            });

            rooms.current
                .on('presence', { event: 'sync' }, async () => {
                    const new_state = rooms.current!.presenceState();
                    let dict: typeof roomItems = {};
                    Object.entries(new_state).forEach(([client, data]) => {
                        let _data = data[0] as any;
                        dict[client] = {
                            allowed_players: _data.allowed_players,
                            current_players: _data.current_players,
                            room_id: _data.room_id,
                            password: _data.password,
                            user_password: '',
                            room_name: _data.room_name,
                            host_id: _data.host_id
                        };
                    });
                    setRoomItems({ ...dict });
                    console.log(dict)
                })
                .subscribe();
        };
        f();

        return () => {
            if (rooms.current)
                rooms.current.unsubscribe();
        }
    }, [isReady])

    return (
        <div className=" relative w-full h-full bg-[#84a6c9] flex justify-center items-center">

            <div className=' z-20 w-full h-full flex justify-start items-start pointer-events-none p-2'>
                <motion.div className=" pointer-events-auto text-sm font-semibold p-1 pl-2 pr-2 border-2 border-white rounded-md select-none text-white cursor-pointer"
                    initial={{ scale: 1, color: "#ffffff" }}
                    whileHover={{ scale: 1.2, color: "#000000" }}
                    transition={{
                        type: "spring",
                        bounce: 0.6,
                    }}
                    whileTap={{ scale: 0.8, rotateZ: 0 }}
                    onClick={() => {
                        exit();
                        setFading(true, '/');
                    }}
                >
                    Back
                </motion.div>
            </div>

            <div className=' z-20 w-full h-full absolute flex justify-center items-center select-none pointer-events-none'>

                <motion.div ref={roomMenuScope} className=' w-full h-full bg-[#273457] pointer-events-auto p-2 flex-col justify-start items-start gap-3'
                    initial={{ opacity: 0 }}
                    style={{
                        display: 'none'
                    }}
                >
                    <div className=' w-full flex justify-between items-center text-white font-semibold'>
                        <div className='inline-flex justify-start items-center gap-2'>
                            <div className=' p-1 pl-2 pr-2 rounded-sm cursor-pointer bg-opacity-50'
                                style={{
                                    background: menuType === 'all' ? '#d5d3b8' : '#8c96b0'
                                }}
                                onClick={() => {
                                    setMenuType('all');
                                }}
                            >
                                All Rooms
                            </div>
                            <div className=' p-1 pl-2 pr-2 rounded-sm cursor-pointer bg-opacity-50'
                                style={{
                                    background: menuType === 'create' ? '#d5d3b8' : '#8c96b0'
                                }}
                                onClick={() => {
                                    setMenuType('create')
                                }}
                            >
                                Create New Room
                            </div>
                        </div>
                        <div className=' p-1 pl-2 pr-2 bg-[#8c96b0] rounded-sm cursor-pointer hover:bg-[#9da7bd] bg-opacity-50'
                            onClick={() => {
                                setOpenRoomMenu(false);
                            }}
                        >
                            Close
                        </div>
                    </div>
                    <hr className=' w-full border-[#6b738a]' />

                    {
                        menuType === 'all' ?
                            <div className=' w-full grid grid-cols-1 md:grid-cols-4 text-white font-semibold gap-5'>
                                {
                                    Object.entries(roomItems).map(([client, item], index) => {
                                        return (
                                            <div key={`room-${index}`} className='bg-[#606e94] rounded-sm p-2 min-h-[150px] flex flex-col justify-start items-start'>
                                                <div className='w-full inline-flex justify-between items-center'>
                                                    <p>{item.room_name}</p>
                                                    {
                                                        item.password ?
                                                            <FaLock /> :
                                                            <></>
                                                    }
                                                </div>
                                                <hr className=' mt-1 w-full border-[#6b738a]' />
                                                <div className=' mt-2 w-full flex justify-start items-center gap-2'>
                                                    <p>{item.current_players}</p>
                                                    <p>/</p>
                                                    <p>{item.allowed_players}</p>
                                                </div>
                                                {
                                                    item.password ?
                                                        <input value={roomItems[client].user_password} type='password' className=' mt-2 rounded-md h-[25px] w-full p-1 bg-white text-black'
                                                            onChange={(e) => {
                                                                setRoomItems({
                                                                    ...roomItems,
                                                                    [client]: {
                                                                        ...item,
                                                                        user_password: e.target.value
                                                                    }
                                                                })
                                                            }}
                                                        /> :
                                                        <></>
                                                }
                                                <div className=' mt-4 w-full inline-flex justify-end'>
                                                    <div className=' pl-2 pr-2 p-1 bg-[#3c4254] hover:bg-[#575e73] cursor-pointer select-none rounded-sm'
                                                        onClick={() => {
                                                            if (item.current_players + 1 > item.allowed_players)
                                                                return;
                                                            if (item.password) {
                                                                if (item.password !== item.user_password) {
                                                                    setRoomItems({
                                                                        ...roomItems,
                                                                        [client]: {
                                                                            ...item,
                                                                            user_password: ''
                                                                        }
                                                                    })
                                                                    return;
                                                                }
                                                            }

                                                            setHost(false);
                                                            setAudio('music', 'LobbyBGM.mp3');
                                                            setFading(true, `/matching/${item.room_id}`);
                                                        }}
                                                    >
                                                        <p>Enter</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                }
                            </div> :
                            <div className=' w-full flex justify-start items-center'>
                                <div className=' w-1/3 p-2 bg-[#8c96b0] gap-2 flex flex-col justify-start items-start font-semibold text-white'>
                                    <p>Room Name</p>
                                    <input value={roomName} className=' w-full p-1 rounded-sm text-black'
                                        onChange={(e) => {
                                            setRoomName(e.target.value);
                                        }}
                                    />
                                    <p>Allowed Players</p>
                                    <input type='number' value={roomPlayers} className=' w-full p-1 rounded-sm text-black'
                                        onChange={(e) => {
                                            let val = parseInt(e.target.value);
                                            if (val < 2)
                                                val = 2;
                                            if (val > 4)
                                                val = 4;
                                            setRoomPlayers(val);
                                        }}
                                    />
                                    <p>Password (Optional)</p>
                                    <input value={password} type='password' className=' w-full p-1 rounded-sm text-black'
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                        }}
                                    />
                                    <div className=' mt-5 cursor-pointer hover:opacity-80 w-full inline-flex justify-center items-center p-2 bg-[#273457]'
                                        onClick={async () => {
                                            if (isNaN(roomPlayers))
                                                return;
                                            if (!rooms.current)
                                                return;

                                            exit();

                                            setGMState(roomPlayers, 0, account.user_id, password, roomName, account.user_id);
                                            setHost(true);
                                            setAudio('music', 'LobbyBGM.mp3');
                                            setFading(true, `/matching/${account.user_id}`);
                                        }}
                                    >
                                        Create
                                    </div>
                                </div>
                            </div>
                    }

                </motion.div>
            </div>

            <GameUILayer forwardedRef={ui} width={screenSize.width} height={screenSize.height} />
            <GameContainerLayer forwardRef={container} />
        </div>
    )
}