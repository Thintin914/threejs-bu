import { SparklesCore } from "./ui/sparkles";
import { AnimatedTooltip } from "./ui/animated-tooltip";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from ".";
import { useEffect } from "react";
import { useAccountStore } from "./utils/zustand/useAccountStore";
import { motion } from "framer-motion";
import { useTransitionStore } from "./utils/zustand/useTransitionStore";

const people = [
  {
    id: 1,
    name: "Jacky Wu",
    designation: "Game Programmer",
    image:
      "./images/jacky-wu.png",
  },
  {
    id: 2,
    name: "Tim Ho",
    designation: "Game Programmer",
    image:
      "./images/tim-ho.jpg",
  },
];

export function Cover() {

  const { setAccount, account } = useAccountStore();
  const { setFading, setAudio } = useTransitionStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (session.user.identities) {
          let data = session.user.identities[0].identity_data;
          let username = '';
          let email = session.user.email ? session.user.email : '';
          if (data) {
            username = data['full_name'];
          }
          setAccount({
            user_id: session.user.identities[0].user_id,
            username: username,
            email: email
          })
        }
      } else {
        setAccount({
          user_id: '',
          username: '',
          email: ''
        })
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (session.user.identities) {
          let data = session.user.identities[0].identity_data;
          let username = '';
          let email = session.user.email ? session.user.email : '';
          if (data) {
            username = data['full_name'];
          }
          setAccount({
            user_id: session.user.identities[0].user_id,
            username: username,
            email: email
          })
        }
      } else {
        setAccount({
          user_id: '',
          username: '',
          email: ''
        })
      }
    });

    setFading(false, '');
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className=" relative h-full w-full bg-[#8FB1D6] flex flex-col items-center justify-start p-1">

      <p className=" mb-5 pl-5 text-white font-mono text-xl">made by</p>

      <div className="flex flex-row items-center justify-center mb-10 w-full">
        <AnimatedTooltip items={people} />
      </div>

      <h1 className="md:text-7xl text-3xl lg:text-7xl font-bold text-center text-white relative z-20 select-none">
        King of Battlefield
      </h1>
      <div className="w-[40rem] h-40 relative">
        {/* Gradients */}
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-zinc-200 to-transparent h-[2px] w-3/4 blur-sm" />
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-zinc-200 to-transparent h-px w-3/4" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

        {/* Core component */}
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={1200}
          className="w-full h-[10vh]"
          particleColor="#FFFFFF"
        />

        {/* Radial Gradient to prevent sharp edges */}
        <div className="absolute inset-0 w-full h-[10vh] bg-[#8FB1D6] [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>

        <div className=" w-full inline-flex justify-center items-center">
          {
            account.user_id === '' ?
              <Auth
                supabaseClient={supabase}
                appearance={{ theme: ThemeSupa }}
                providers={["google"]}
                redirectTo={window.location.origin}
              /> :
              <div className=" flex flex-col justify-center items-center">
                <p className=" mb-5 text-white">{`Welcome, ${account.username}!`}</p>
                <motion.div
                  className=" mb-5 text-2xl font-semibold p-1 pl-2 pr-2 border-2 border-white rounded-md select-none text-white cursor-pointer"
                  initial={{ scale: 1, color: "#ffffff" }}
                  whileHover={{ scale: 1.5, color: "#000000" }}
                  transition={{
                    type: "spring",
                    bounce: 0.6,
                  }}
                  whileTap={{ scale: 0.8, rotateZ: 0 }}
                  onClick={() => {
                    setAudio('music', 'LobbyBGM.mp3');
                    setFading(true, '/lobby');
                  }}
                >
                  <p>Play</p>
                </motion.div>
                <motion.div
                  className=" text-2xl font-semibold p-1 pl-2 pr-2 border-2 border-white rounded-md select-none text-white cursor-pointer"
                  initial={{ scale: 1, color: "#ffffff" }}
                  whileHover={{ scale: 1.5, color: "#000000" }}
                  transition={{
                    type: "spring",
                    bounce: 0.6,
                  }}
                  whileTap={{ scale: 0.8, rotateZ: 0 }}
                  onClick={() => {
                    supabase.auth.signOut();
                    setAccount({
                      user_id: '',
                      username: '',
                      email: ''
                    })
                  }}
                >
                  <p>Logout</p>
                </motion.div>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
