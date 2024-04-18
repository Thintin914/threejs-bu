import * as THREE from 'three';
import * as CANNON from 'cannon-es'
import { Entity, downloadFile } from "../gameInitFunctions";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RealtimeChannel } from '@supabase/supabase-js';

export const loader = new GLTFLoader();

export async function initializeEntity(entity: Entity, scene: THREE.Scene, world: CANNON.World, ui: HTMLDivElement, hitboxRef: Record<number, string>, setCaches: (name: string, file: Blob) => void, caches: Record<string, Blob>, room?: RealtimeChannel){
    let transform = entity.components['transform'];
    let _scale = {x: 1, y: 1, z: 1};
    if (transform.scale){
        _scale = transform.scale;
    }

    let components = Object.values(entity.components);
    for(let i = 0; i < components.length; i++){
        let component = components[i];
        switch (component.id){
            case 'death': {
                component.trigger = false;
                break;
            }
            case 'spotlight': {
                const spotLight = new THREE.SpotLight( component.color, component.intensity, component.distance, 0.295);
                spotLight.position.set( transform.x, transform.y, transform.z );

                const cone_material = new THREE.ShaderMaterial({
                    uniforms: {
                      color1: {
                        value: new THREE.Color(component.beam_color1)
                      },
                      color2: {
                        value: new THREE.Color(component.beam_color2)
                      }
                    },
                    vertexShader: `
                      varying vec2 vUv;
                  
                      void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                      }
                    `,
                    fragmentShader: `
                      uniform vec3 color1;
                      uniform vec3 color2;
                    
                      varying vec2 vUv;
                      
                      void main() {
                        
                        gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
                      }
                    `
                  });

                const cone = new THREE.Mesh( new THREE.CylinderGeometry(0.01, 0.1, 1, 16), cone_material );
                cone.material.side = THREE.BackSide;
                spotLight.attach(cone);
                entity.gameObject.model = spotLight;
                component.follow_id = component.follow_id ? component.follow_id : '';
                break;
            }
            case 'controller2': {
                component.speed = 0;
                component.vector = {x: 0, y: 0, z: 0};
                component.cooldown = 0;
                component.clockwise = true;
                component.max_cooldown = component.max_cooldown ? component.max_cooldown : 36;
                break;
            }
            case 'sync': {
                component.t = 0;
                break;
            }
            case 'model': {
                let model_blob = null;
                if (caches[`${component.bucket}/${component.file}`]){
                    model_blob = caches[`${component.bucket}/${component.file}`];
                } else {
                    model_blob = await downloadFile(component.bucket, component.file);
                    if (model_blob)
                        setCaches(`${component.bucket}/${component.file}`, model_blob);
                }
                if (!model_blob)
                    continue;

                let model_array_buffer = await model_blob?.arrayBuffer();
                let model_gltf = await loader.parseAsync(model_array_buffer, "");
                let model = model_gltf.scene;
                if (component.animation !== undefined || component.animation !== null){
                    let model_animation = model_gltf.animations[component.animation];
                    if (model_animation){
                        entity.components['animation'] = {
                            id: 'animation'
                        };
                        model.animations.push(model_animation);
                        let mixer = new THREE.AnimationMixer(model);
                        mixer.clipAction(model_animation).play();
                        entity.gameObject.mixer = mixer;
                    }
                }
                model.castShadow = true;
                model.receiveShadow = true;

                _scale = component.scale;
                entity.gameObject.model = model;
                break;
            }
            case 'hitbox': {
                const box = new CANNON.Body({mass: 0})
                box.fixedRotation = true;
                box.addShape(new CANNON.Box(new CANNON.Vec3(component.width * 0.5, component.height * 0.5, component.depth * 0.5)));
                box.shapes[0].material = new CANNON.Material({friction: 0});
                entity.gameObject.hitbox = box;
                break;
            }
            case 'dev_hitbox': {
                entity.gameObject.dev_hitbox = new THREE.Mesh( new THREE.BoxGeometry( component.width, component.height, component.depth ), new THREE.MeshBasicMaterial( {color: 0xcbdbb8} ) );
                scene.add(entity.gameObject.dev_hitbox);
                break;
            }
            case 'dev_circle_plane': {
                component.id = 'dev_hitbox';
                entity.gameObject.dev_hitbox = new THREE.Mesh( new THREE.CylinderGeometry(component.radius * _scale.x, component.radius * _scale.x, 0.2, component.segments), new THREE.MeshBasicMaterial( {color: 0xcbdbb8, side: THREE.DoubleSide} ) );
                scene.add(entity.gameObject.dev_hitbox);
                break;
            }
            case 'circle_plane': {
                entity.gameObject.model = new THREE.Mesh( new THREE.CylinderGeometry(component.radius * _scale.x, component.radius * _scale.x, 0.2, component.segments), new THREE.MeshBasicMaterial( {color: component.color, side: THREE.DoubleSide} ) );
                const circle_plane = new CANNON.Body({mass: 0})
                circle_plane.addShape(new CANNON.Cylinder(component.radius * _scale.x, component.radius * _scale.x, 0.2, component.segments));
                circle_plane.shapes[0].material = new CANNON.Material({friction: 0});;
                entity.gameObject.hitbox = circle_plane;
                break;
            }
            case 'box': {
                entity.gameObject.model = new THREE.Mesh( new THREE.BoxGeometry( component.width, component.height, component.depth ), new THREE.MeshBasicMaterial( {color: component.color} ) );
                const box = new CANNON.Body({mass: 0})
                box.fixedRotation = true;
                box.addShape(new CANNON.Box(new CANNON.Vec3(component.width * _scale.x * 0.5, component.height * _scale.y * 0.5, component.depth * _scale.z * 0.5)));
                box.shapes[0].material = new CANNON.Material({friction: 0});
                entity.gameObject.hitbox = box;
                break;
            }
            case 'physic': {
                if (!entity.gameObject.hitbox)
                    break;
                component.vel_x = 0;
                component.vel_y = 0;
                component.vel_z = 0;

                component.vel_cam_x = 0;
                component.vel_cam_y = 0;
                component.vel_cam_z = 0;

                component.collide_index = -1;
                let hitbox = entity.gameObject.hitbox as CANNON.Body;
                hitbox.mass = component.mass ? component.mass : 1;
                hitbox.type = CANNON.Body.DYNAMIC;
                hitbox.updateMassProperties();

                if (component.apply_force){
                    const onCollide = (e: any) =>{
                        entity.components['collision'].collide_index = e.body.index;
                    }
                    hitbox.addEventListener('collide', onCollide);
                }
                break;
            }
            case 'text': {
                component.x = component.x ? component.x : 0;
                component.y = component.y ? component.y : 0;
                component.z = component.z ? component.z : 0;
                component.size = component.size ? component.size : 12;
                component.screen_x = component.text.length * component.size * -0.2;
                let text = document.createElement('p');
                text.innerText = component.text;
                text.style.position = 'absolute';
                text.style.left = '0px';
                text.style.top = '0px';
                text.style.fontSize = `${component.size}px`;
                text.style.color = component.color ? component.color : '#000000';
                text.style.userSelect = 'none';
                if (component.onClick){
                    text.style.cursor = 'pointer';
                    text.addEventListener('click', component.onClick);
                }
                ui.appendChild(text);
                entity.gameObject.text = text;
            }
        }
    }

    if (!entity.components['type']){
        entity.components['type'] = {
            id: 'type',
            name: ''
        };
    }

    // Apply Transform To Model
    if (entity.gameObject.model){
        scene.add(entity.gameObject.model);

        const model = entity.gameObject.model;

        entity.components['transform'] = {
            ...entity.components['transform'],
            x: transform.x ? transform.x : 0,
            y: transform.y ? transform.y : 0,
            z: transform.z ? transform.z : 0,
            offset: transform.offset ? transform.offset : {x: 0, y: 0, z: 0},
            rotate_x: transform.rotate_x ? transform.rotate_x : 0,
            rotate_y: transform.rotate_y ? transform.rotate_y : 0,
            rotate_z: transform.rotate_z ? transform.rotate_z : 0,
            rotate_offset: transform.rotate_offset ? transform.rotate_offset : {x: 0, y: 0, z: 0},
            scale: _scale,
            time_scale: 0,
            time_rotate: 0
        };
        transform = entity.components['transform'];
        model.translateX(transform.x + transform.offset.x);
        model.translateY(transform.y + transform.offset.y);
        model.translateZ(transform.z + transform.offset.z);
        model.rotateX(transform.rotate_x + transform.rotate_offset.x);
        model.rotateY(transform.rotate_y + transform.rotate_offset.y);
        model.rotateZ(transform.rotate_z + transform.rotate_offset.z);
        model.scale.set(0, 0, 0);

    }

    if (entity.gameObject.hitbox){
        world.addBody(entity.gameObject.hitbox);

        const hitbox = entity.gameObject.hitbox as CANNON.Body;
        hitbox.position.set(transform.x, transform.y, transform.z);
        hitbox.quaternion.setFromEuler(transform.rotate_x, transform.rotate_y, transform.rotate_z);

        hitboxRef[entity.gameObject.hitbox.index] = entity.id;
    }

}
