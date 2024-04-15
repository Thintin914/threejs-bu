import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom"
import { useTransitionStore } from "../utils/zustand/useTransitionStore";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "..";
import { useAccountStore } from "../utils/zustand/useAccountStore";
import { useGMStore } from "../utils/zustand/useGMStore";
import { motion } from "framer-motion";



export function Summary(){

    const {id} = useParams();
    const {account} = useAccountStore();
    const { setFading, setAudio } = useTransitionStore();
    const {score} = useGMStore();

    const initialized = useRef<boolean>(false);
    const room = useRef<RealtimeChannel | null>(null);
    const [players, setPlayers] = useState<Record<string, any>>({});
    useEffect(() =>{
        if (!id)
            return;
        if (room.current)
            return;
        if (initialized.current)
            return;
        initialized.current = true;

        setFading(false, '');

        room.current = supabase.channel(`summary_${id}`, {
            config: {
                presence: {
                    key: account.user_id
                }
            }
        });

        room.current
            .on('presence', { event: 'sync' }, async () => {
                const new_state = room.current!.presenceState();
                let dict = players;
                let new_state_dict = Object.entries(new_state);
                new_state_dict.forEach(([client, data]) => {
                    dict[client] = data[0];
                })
                setPlayers({...dict});
            })
            .subscribe(async (status) => {
                if (status !== 'SUBSCRIBED')
                    return;

                await room.current!.track({
                    username: account.username,
                    score: score
                });
            });

        return () => {
            if (room.current) {
                room.current.untrack();
                room.current.unsubscribe();
            }
        }
    }, [id])

    return (
        <div className="relative h-screen w-full bg-[#8FB1D6] flex flex-col items-center justify-center p-1 gap-5">
            <div className=" p-2 w-fit flex flex-col justify-center items-center text-white bg-zinc-800 bg-opacity-60">
                {
                    Object.values(players).map((player, index) =>{
                        return (
                            <div key={`player-${index}`} className=" inline-flex justify-start items-center gap-4">
                                <p className=" font-semibold">{player.username}</p>
                                <p className=" font-mono">{player.score}</p>
                            </div>
                        )
                    })
                }
            </div>

            <motion.div className=" pointer-events-auto text-sm font-semibold p-1 pl-2 pr-2 border-2 border-white rounded-md select-none text-white cursor-pointer"
                initial={{ scale: 1, color: "#ffffff" }}
                whileHover={{ scale: 1.2, color: "#000000" }}
                transition={{
                    type: "spring",
                    bounce: 0.6,
                }}
                whileTap={{ scale: 0.8, rotateZ: 0 }}
                onClick={() => {
                    if (room.current) {
                        room.current.untrack();
                        room.current.unsubscribe();
                    }
                    setAudio('music', 'LobbyBGM.mp3');
                    setFading(true, '/lobby');
                }}>
                Return Lobby
            </motion.div>
        </div>
    )
}