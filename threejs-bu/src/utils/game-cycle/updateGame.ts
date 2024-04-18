import * as THREE from 'three';
import * as CANNON from 'cannon-es'
import { Entity, lerp, worldToScreenPosition } from '../gameInitFunctions';
import { RealtimeChannel } from '@supabase/supabase-js';

let previous_time = 0;
export function updateGame(time: number, scene: THREE.Scene, world: CANNON.World, renderer: THREE.WebGLRenderer, system: Record<string, Entity>, hitboxRef: Record<number, string>, keyPressed: Record<string, boolean>, camera: THREE.PerspectiveCamera, screenSize: {width: number, height: number}, room?: RealtimeChannel){
    let deltatime = (time - previous_time) / 1000;
    previous_time = time;
    Object.values(system).forEach((entity) =>{
        Object.values(entity.components).forEach((component) =>{
            switch (component.id){
                case 'death': {
                    if (component.trigger){
                        component.trigger = false;
                        switch (component.onDeath){
                            case 'transfer_spotlight': {
                                if (component.killed_by){
                                    const spotlight = system['spotlight'];
                                    const spotlight_spotlight = spotlight.components['spotlight'];
                                    if (spotlight_spotlight.follow_id === entity.id){
                                        const controller2 = entity.components['controller2'];
                                        controller2.max_cooldown = 36;
                                        spotlight_spotlight.follow_id = component.killed_by;
                                        const score = entity.components['score'];
                                        score.trigger = false;
                                        room!.send({
                                            type: 'broadcast',
                                            event: 'tr_spot',
                                            payload: {
                                                id: component.killed_by,
                                                prev: entity.id,
                                                score: score.score
                                            }
                                        })
                                    }
                                }
                                break;
                            }
                        }
                    }
                    break;
                }
                case 'score': {
                    if (component.trigger){
                        component.score += deltatime;
                    }
                    break;
                }
                case 'spotlight': {
                    if (component.follow_id){
                        let follow_entity = system[component.follow_id];
                        if (follow_entity){
                            const spotlight = entity.gameObject.model;
                            spotlight.target = follow_entity.gameObject.model;
                            const follow_entity_transform = follow_entity.components['transform'];
                            const transform = entity.components['transform'];
                            transform.x = follow_entity_transform.x;
                            transform.y = follow_entity_transform.y;
                            transform.z = follow_entity_transform.z;
                        }
                    }
                    break;
                }
                case 'dev_hitbox': {
                    const dev_hitbox = entity.gameObject.dev_hitbox;
                    const transform = entity.components['transform'];
                    dev_hitbox.position.set(transform.x, transform.y, transform.z);
                    break;
                }
                case 'transform': {
                    const model = entity.gameObject.model;

                    let new_position = {
                        x: lerp(model.position.x, component.x, component.time_rotate),
                        y: lerp(model.position.y, component.y, component.time_rotate),
                        z: lerp(model.position.z, component.z, component.time_rotate)
                    };
                    model.position.set(new_position.x + component.offset.x, new_position.y + component.offset.y, new_position.z + component.offset.z);
                    if (component.time_scale < 1){
                        let new_scale = {
                            x: lerp(model.scale.x, component.scale.x, component.time_scale),
                            y: lerp(model.scale.y, component.scale.y, component.time_scale),
                            z: lerp(model.scale.z, component.scale.z, component.time_scale)
                        };
                        model.scale.set(new_scale.x, new_scale.y, new_scale.z);
                        if (component.time_scale + deltatime < 1)
                            component.time_scale += deltatime;
                    }
                    if (component.time_rotate < 1){
                        model.quaternion.setFromEuler(
                            new THREE.Euler(
                                component.rotate_x + component.rotate_offset.x,
                                lerp(model.rotation.y, component.rotate_y, component.time_rotate) + component.rotate_offset.y,
                                component.rotate_z + component.rotate_offset.z
                            )
                        );
                        if (component.time_rotate + deltatime < 1)
                            component.time_rotate += deltatime;
                    }
                    break;
                }
                case 'animation': {
                    if (component.current !== component.prev){
                        if (component.current !== ''){
                            if (component.prev){
                                let previous_clip = entity.gameObject.mixer.clipAction(component.clip[component.prev]);
                                previous_clip.fadeOut(0.3);
                                previous_clip.clampWhenFinished = true;
                            }
                            let current_clip = entity.gameObject.mixer.clipAction(component.clip[component.current]);
                            current_clip.clampWhenFinished = false;
                            current_clip.enabled = true;
                            current_clip.fadeIn(0.1);
                            current_clip.play();
                        } else {
                            entity.gameObject.mixer.stopAllAction();
                        }
                        component.prev = component.current;
                    }

                    if (component.current !== ''){
                        entity.gameObject.mixer.update( deltatime );
                    }
                    break;
                }
                case 'sync': {
                    component.t += deltatime;
                    if (component.t > 0.05){
                        const transform = entity.components['transform'];
                        component.t = 0;
                        room!.send({
                            type: 'broadcast',
                            event: 't',
                            payload: {
                                id: entity.id,
                                transform: {
                                    rotation: {
                                        x: transform.rotate_x + transform.rotate_offset.x,
                                        y: transform.rotate_y + transform.rotate_offset.y,
                                        z: transform.rotate_z + transform.rotate_offset.z
                                    },
                                    position: {
                                        x: transform.x + transform.offset.x,
                                        y: transform.y + transform.offset.y,
                                        z: transform.z + transform.offset.z
                                    },
                                    scale: transform.scale
                                }
                            },
                        })
                    }
                    break;
                }
                case 'controller': {
                    const transform = entity.components['transform'];
                    const physic = entity.components['physic'];
                    const sync = entity.components['sync'];
                    const animation = entity.components['animation'];

                    let pressed = false;
                    let first_press = false;
                    let prev = component.previous;
                    if (!prev)
                        prev = keyPressed;
                    
                    if (keyPressed['ArrowLeft']){
                        physic.vel_x -= 12 * deltatime;
                        physic.vel_cam_x -= 0.005;
                        pressed = true;
                        if (!prev['ArrowLeft']){
                            first_press = true;
                        }
                    }
                    if (keyPressed['ArrowRight']){
                        physic.vel_x += 12 * deltatime;
                        physic.vel_cam_x += 0.005;
                        pressed = true;
                        if (!prev['ArrowRight']){
                            first_press = true;
                        }
                    }
                    if (keyPressed['ArrowUp']){
                        physic.vel_z -= 12 * deltatime;
                        physic.vel_cam_z -= 0.005;
                        pressed = true;
                        if (!prev['ArrowUp']){
                            first_press = true;
                        }
                    }
                    if (keyPressed['ArrowDown']){
                        physic.vel_z += 12 * deltatime;
                        physic.vel_cam_z += 0.005;
                        pressed = true;
                        if (!prev['ArrowDown']){
                            first_press = true;
                        }
                    }
                    if (first_press){
                        transform.time_rotate = 0;
                        if (sync){
                            room!.send({
                                type: 'broadcast',
                                event: 'tr',
                                payload: {
                                    id: entity.id
                                }
                            })
                        }
                    }

                    if (animation){
                        if (pressed)
                            animation.current = 'walk';
                        else
                            animation.current = 'idle';
                    }

                    component.previous = keyPressed;

                    if (physic.static){
                        const normalized_vel = new THREE.Vector3(physic.vel_x, physic.vel_y, physic.vel_z).normalize();
                        const mx = new THREE.Matrix4().lookAt(normalized_vel,new THREE.Vector3(0,0,0),new THREE.Vector3(0,1,0));
                        const euler = new THREE.Euler().setFromRotationMatrix(mx);
                        
                        transform.rotate_x = euler.x;
                        transform.rotate_y = euler.y;
                        transform.rotate_z = euler.z;
                    }
                    break;
                }
                case 'controller2': {
                    const model = entity.gameObject.model;
                    const transform = entity.components['transform'];
                    const physic = entity.components['physic'];
                    const animation = entity.components['animation'];

                    let prev = component.previous;
                    if (!prev)
                        prev = keyPressed;

                    if (keyPressed['ArrowUp']){

                        if (!prev['ArrowUp']){
                            const directionVector = new THREE.Vector3();
                            const rotationMatrix = new THREE.Matrix4();
                            rotationMatrix.makeRotationFromEuler(model.rotation);
                            directionVector.set(0, 0, 1);
                            directionVector.applyMatrix4(rotationMatrix);
                            component.vector = directionVector;
                            component.speed = 12 * deltatime;
                            component.cooldown = 4 * deltatime;
                            component.clockwise = !component.clockwise;
                            if (animation){
                                animation.current = 'walk';
                            }
                        }
                        physic.vel_cam_x += component.vector.x * 0.05;
                        physic.vel_cam_y += component.vector.y * 0.05;

                        if (component.speed > 4){
                            component.cooldown = component.max_cooldown * deltatime;
                        }

                        if (component.cooldown > 0){
                            component.cooldown -= deltatime;
                            component.speed *= 0.8;
                        } else {
                            component.speed += 36 * deltatime;
                        }

                        physic.vel_x = component.vector.x * component.speed;
                        physic.vel_y = component.vector.y * component.speed;
                        physic.vel_z = component.vector.z * component.speed;
                    } else {
                        if (component.clockwise){
                            transform.rotate_y = (transform.rotate_y + (3 * deltatime)) % 360;
                        } else {
                            transform.rotate_y = (transform.rotate_y - (3 * deltatime)) % 360;
                        }
                        if (animation){
                            animation.current = 'idle';
                        }
                    }

                    component.previous = keyPressed;
                    break;
                }
                case 'collision': {
                    if (component.collide_index > -1){
                        if (Object.values(keyPressed).length > 0){
                            let entity_id = hitboxRef[world.bodies[component.collide_index].index]
                            component.collide_index = -1;
                            const opponent = system[entity_id];
                            const opponent_type = opponent.components['type'].name;
                            if (opponent_type === 'player'){
                                const sync = entity.components['sync'];
                                const physic = entity.components['physic'];
                                const opponent_vector = new THREE.Vector3(physic.vel_x, physic.vel_y, physic.vel_z).normalize();
                                if (sync){
                                    room!.send({
                                        type: 'broadcast',
                                        event: 'k',
                                        payload: {
                                            id: entity_id,
                                            x: opponent_vector.x,
                                            y: opponent_vector.y,
                                            z: opponent_vector.z,
                                            force: component.force,
                                            from: entity.id
                                        }
                                    })
                                } else {
                                    const opponent_transform = opponent.components['transform'];
                                    opponent_transform.time_rotate = 0;
                                    opponent_transform.x += opponent_vector.x * component.force;
                                    opponent_transform.y += opponent_vector.y * component.force;
                                    opponent_transform.z += opponent_vector.z * component.force;
                                }
                            }
                        }
                    }
                    break;
                }
                case 'physic': {
                    const hitbox = entity.gameObject.hitbox as CANNON.Body;
                    const transform = entity.components['transform'];
                    if (component.static)
                        hitbox.quaternion.setFromEuler(transform.rotate_x, transform.rotate_y, transform.rotate_z);

                    hitbox.velocity.set(component.vel_x, component.vel_y, component.vel_z);
                    if (hitbox.position.y < -1){
                        hitbox.position.set(0, 0.5, 0);
                        const death = entity.components['death'];
                        if (death){
                            death.trigger = true;
                        }
                    }
                    component.vel_x *= 0.8;
                    component.vel_y *= 0.8;
                    component.vel_z *= 0.8;
                    component.vel_cam_x *= 0.95;
                    component.vel_cam_y *= 0.95;
                    component.vel_cam_z *= 0.95;
                    transform.x = hitbox.position.x;
                    transform.y = hitbox.position.y;
                    transform.z = hitbox.position.z;
                    break;
                }
                case 'camera': {
                    const transform = entity.components['transform'];
                    const physic = entity.components['physic'];
                    camera.lookAt(new THREE.Vector3(transform.x, transform.y, transform.z));
                    camera.position.x = transform.x + physic.vel_cam_x;
                    camera.position.y = transform.y + physic.vel_cam_y + 0.4;
                    camera.position.z = transform.z + physic.vel_cam_z + 0.6;
                    break;
                }
                case 'camera2': {
                    const transform = entity.components['transform'];
                    const physic = entity.components['physic'];
                    camera.lookAt(new THREE.Vector3(transform.x, transform.y, transform.z));
                    camera.position.x = transform.x + physic.vel_cam_x;
                    camera.position.y = transform.y + 1.2 + physic.vel_cam_y;
                    camera.position.z = transform.z + 0.6 + physic.vel_cam_z;
                    break;
                }
                case 'text': {
                    const model = entity.gameObject.model
                    let pos = worldToScreenPosition(screenSize.width, screenSize.height, model.position.x + component.x, model.position.y + component.y, model.position.z + component.z, camera);
                    const text = entity.gameObject.text as HTMLParagraphElement;
                    text.style.left = `${pos.x + component.screen_x}px`;
                    text.style.top = `${pos.y}px`;
                }
            }
        })
    })
    world.step(1 / 30);
    renderer.render( scene, camera );
}