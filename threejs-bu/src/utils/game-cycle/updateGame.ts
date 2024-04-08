import * as THREE from 'three';
import * as CANNON from 'cannon-es'
import { Entity, lerp, worldToScreenPosition } from '../gameInitFunctions';
import { RealtimeChannel } from '@supabase/supabase-js';

export function updateGame(scene: THREE.Scene, world: CANNON.World, renderer: THREE.WebGLRenderer, system: Record<string, Entity>, keyPressed: Record<string, boolean>, camera: THREE.PerspectiveCamera, screenSize: {width: number, height: number}, room?: RealtimeChannel){
    Object.values(system).forEach((entity) =>{
        Object.values(entity.components).forEach((component) =>{
            switch (component.id){
                case 'dev_hitbox': {
                    const dev_hitbox = entity.gameObject.dev_hitbox;
                    const hitbox = entity.gameObject.hitbox as CANNON.Body;
                    dev_hitbox.position.copy(hitbox.position);
                    break;
                }
                case 'transform': {
                    const model = entity.gameObject.model;

                    let new_position = {
                        x: lerp(model.position.x, component.x, component.time_rotate),
                        y: lerp(model.position.y, component.y, component.time_rotate),
                        z: lerp(model.position.z, component.z, component.time_rotate)
                    };
                    model.position.set(new_position.x, new_position.y, new_position.z);
                    if (component.time_scale < 1){
                        let new_scale = {
                            x: lerp(model.scale.x, component.scale.x, component.time_scale),
                            y: lerp(model.scale.y, component.scale.y, component.time_scale),
                            z: lerp(model.scale.z, component.scale.z, component.time_scale)
                        };
                        model.scale.set(new_scale.x, new_scale.y, new_scale.z);
                        if (component.time_scale + 0.05 < 1)
                            component.time_scale += 0.05;
                    }
                    if (component.time_rotate < 1){
                        model.quaternion.setFromEuler(
                            new THREE.Euler(
                                lerp(model.rotation.x, component.rotate_x, 1),
                                lerp(model.rotation.y, component.rotate_y, component.time_rotate),
                                lerp(model.rotation.z, component.rotate_z, 1)
                            )
                        );
                        if (component.time_rotate + 0.01 < 1)
                            component.time_rotate += 0.01;
                    }
                    break;
                }
                case 'sync': {
                    component.t++;
                    if (component.t > 9){
                        const transform = entity.components['transform'];
                        component.t = 0;
                        room!.send({
                            type: 'broadcast',
                            event: 't',
                            payload: {
                                id: entity.id,
                                transform: {
                                    rotation: {
                                        x: transform.rotate_x,
                                        y: transform.rotate_y,
                                        z: transform.rotate_z
                                    },
                                    position: {
                                        x: transform.x,
                                        y: transform.y,
                                        z: transform.z
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

                    let first_press = false;
                    let prev = component.previous;
                    if (!prev)
                        prev = keyPressed;
                    
                    if (keyPressed['ArrowLeft']){
                        physic.vel_x -= 0.1;
                        physic.vel_cam_x -= 0.005;
                        if (!prev['ArrowLeft']){
                            first_press = true;
                        }
                    }
                    if (keyPressed['ArrowRight']){
                        physic.vel_x += 0.1;
                        physic.vel_cam_x += 0.005;
                        if (!prev['ArrowRight']){
                            first_press = true;
                        }
                    }
                    if (keyPressed['ArrowUp']){
                        physic.vel_z -= 0.1;
                        physic.vel_cam_z -= 0.005;
                        if (!prev['ArrowUp']){
                            first_press = true;
                        }
                    }
                    if (keyPressed['ArrowDown']){
                        physic.vel_z += 0.1;
                        physic.vel_cam_z += 0.005;
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
                        }

                        physic.vel_x = component.vector.x * 0.5;
                        physic.vel_y = component.vector.y * 0.5;
                        physic.vel_z = component.vector.z * 0.5;

                    } else {
                        transform.rotate_y = (transform.rotate_y + 0.05) % 360;
                    }

                    component.previous = keyPressed;
                    break;
                }
                case 'physic': {
                    const hitbox = entity.gameObject.hitbox as CANNON.Body;
                    const transform = entity.components['transform'];
                    if (component.static)
                        hitbox.quaternion.setFromEuler(transform.rotate_x, transform.rotate_y, transform.rotate_z);
                    hitbox.velocity.set(component.vel_x, component.vel_y, component.vel_z);
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
                case 'text': {
                    const model = entity.gameObject.model;
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