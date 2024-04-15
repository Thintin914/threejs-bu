import { useEffect, useRef, useState } from "react";
import { Entity } from "./gameInitFunctions";
import * as THREE from 'three';
import * as CANNON from 'cannon-es'
import { exit } from "process";

export function useGame(props: {container: HTMLDivElement, ui: HTMLDivElement}){

    const [screenSize, setScreenSize] = useState<{width: number, height: number}>({width: 0, height: 0});

    const system = useRef<Record<string, Entity>>({});
    const hitboxRef = useRef<Record<number, string>>({});
    const camera = useRef<THREE.PerspectiveCamera | null>(null);
    const scene = useRef<THREE.Scene | null>(null);
    const renderer = useRef<THREE.WebGLRenderer | null>(null);
    const ambientLight = useRef<THREE.AmbientLight | null>(null);
    const pointLight = useRef<THREE.PointLight | null>(null);

    const world = useRef<CANNON.World | null>(null);

    const [stopGame, setStopGame] = useState<boolean>(false);
    const [keyPressed, setKeyPressed] = useState<Record<string, boolean>>({});

    const [isReady, setIsReady] = useState<boolean>(false);

    // GC
    function Exit(){
        camera.current?.remove();
        camera.current = null;

        if (world.current)
            world.current.bodies = [];

        if (scene.current){
            scene.current.remove();
            scene.current = null;
        }

        if (renderer.current){
            renderer.current.setAnimationLoop(null);
            renderer.current.dispose();
            renderer.current = null;
        }

        system.current = {};
        hitboxRef.current = {};
        props.ui.innerHTML = '';

        setIsReady(false);
    }

    const [init, setInit] = useState<boolean>(false);
    const counted = useRef<boolean>(false);
    useEffect(() =>{
        if (counted.current)
            return;
        if (!init)
            return;
        if (!props.container)
            return;
        if (!props.ui)
            return;
        counted.current = true;

        // init THREEjs starts
        camera.current = new THREE.PerspectiveCamera( 70, 16 / 9, 0.01, 10 );
        
        camera.current.position.y = 0.5;
        camera.current.position.z = 1;
        camera.current.rotateX(-0.4);

        scene.current = new THREE.Scene();

        ambientLight.current = new THREE.AmbientLight( 0x000D67, 5 );
        scene.current.add( ambientLight.current );

        pointLight.current = new THREE.PointLight(0x76599E, 4, 10, 0);
        pointLight.current.position.set(0, 1, 0);
        pointLight.current.rotation.set(20, 0, 0);
        scene.current.add(pointLight.current);

        renderer.current = new THREE.WebGLRenderer( { antialias: true } );
        renderer.current.setSize( window.innerWidth, window.innerHeight );
        renderer.current.setClearColor( 0x8FB1D6 );

        props.container.appendChild(renderer.current.domElement);

        // init THREEjs ends

        // init CANNONjs starts

        world.current = new CANNON.World();
        world.current.gravity.set(0,-9.81,0);
        world.current.broadphase = new CANNON.NaiveBroadphase();

        // init CANNONjs ends
        
        onresize();
        setIsReady(true);

        return () =>{
            Exit()
        }

    }, [init])

    const onresize = () =>{
        if (!renderer.current)
            return;

        let _width = window.innerWidth;
        let _height = window.innerHeight;
        
        let currentAspectRatio =  _width / _height;
        let aspectRatio = 16 / 9;

        let newWidth = 0;
        let newHeight = 0;
        if (currentAspectRatio > aspectRatio) {
            // The current aspect ratio is wider than 16:9
            newWidth = _height * aspectRatio;
            newHeight = _height;
        } else {
            // The current aspect ratio is taller or equal to 16:9
            newWidth = _width;
            newHeight = _width / aspectRatio;
            }

        renderer.current!.setSize(newWidth, newHeight);

        setScreenSize(
            {
                width: newWidth,
                height: newHeight
            }
        );

    }

    useEffect(() =>{
        if (stopGame){
            setKeyPressed({});
        }
    }, [stopGame])

    // resize window
    useEffect(() =>{
        const onkeydown = (e: KeyboardEvent) => {
            if (stopGame)
                return;

            let dict = keyPressed;

            dict[e.key] = true;
            setKeyPressed({...dict});
        }
        const onkeyup = (e: KeyboardEvent) => {
            if (stopGame)
                return;

            let dict = keyPressed;

            delete dict[e.key];
            setKeyPressed({...dict});
        }
        window.addEventListener('resize', onresize);
        window.addEventListener('keydown', onkeydown);
        window.addEventListener('keyup', onkeyup);
        onresize();
        return () =>{
            window.removeEventListener('resize', onresize);
            window.removeEventListener('keydown', onkeydown);
            window.removeEventListener('keyup', onkeyup);
        }
    }, [])

    return ({
        screenSize: screenSize,
        system: system.current!,
        hitboxRef: hitboxRef.current!,
        camera: camera.current!,
        scene: scene.current!,
        renderer: renderer.current!,
        world: world.current!,
        keyPressed: keyPressed,
        isReady: isReady,
        isStop: stopGame,
        ambientLight: ambientLight.current!,
        pointLight: pointLight.current!,
        exit: Exit,
        init: setInit,
        stop: setStopGame
    })
}