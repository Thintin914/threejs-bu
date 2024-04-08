import * as THREE from 'three';
import * as CANNON from 'cannon-es'
import { Entity, downloadFile } from "../gameInitFunctions";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RealtimeChannel } from '@supabase/supabase-js';

export const loader = new GLTFLoader();

export async function initializeEntity(entity: Entity, scene: THREE.Scene, world: CANNON.World, ui: HTMLDivElement, room?: RealtimeChannel){
    let transform = entity.components['transform'];
    let _scale = {x: 1, y: 1, z: 1};
    if (transform.scale){
        _scale = transform.scale;
    }

    let components = Object.values(entity.components);
    for(let i = 0; i < components.length; i++){
        let component = components[i];
        switch (component.id){
            case 'sync': {
                component.t = 0;
                break;
            }
            case 'model': {
                let model_blob = await downloadFile(component.bucket, component.file);
                if (!model_blob)
                    continue;

                let model_array_buffer = await model_blob?.arrayBuffer();
                let model_gltf = await loader.parseAsync(model_array_buffer, "");
                let model = model_gltf.scene;
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

                let hitbox = entity.gameObject.hitbox as CANNON.Body;
                hitbox.mass = component.mass ? component.mass : 1;
                hitbox.type = CANNON.Body.DYNAMIC;
                hitbox.updateMassProperties();
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

    // Apply Transform To Model
    if (entity.gameObject.model){
        scene.add(entity.gameObject.model);

        const model = entity.gameObject.model;

        entity.components['transform'] = {
            ...entity.components['transform'],
            x: transform.x ? transform.x : 0,
            y: transform.y ? transform.y : 0,
            z: transform.z ? transform.z : 0,
            rotate_x: transform.rotate_x ? transform.rotate_x : 0,
            rotate_y: transform.rotate_y ? transform.rotate_y : 0,
            rotate_z: transform.rotate_z ? transform.rotate_z : 0,
            scale: _scale,
            time_scale: 0,
            time_rotate: 0
        };
        transform = entity.components['transform'];
        model.translateX(transform.x);
        model.translateY(transform.y);
        model.translateZ(transform.z);
        model.rotateX(transform.rotate_x);
        model.rotateY(transform.rotate_y);
        model.rotateZ(transform.rotate_z);
        model.scale.set(0, 0, 0);

    }

    if (entity.gameObject.hitbox){
        world.addBody(entity.gameObject.hitbox);

        const hitbox = entity.gameObject.hitbox as CANNON.Body;
        hitbox.position.set(transform.x, transform.y, transform.z);
        hitbox.quaternion.setFromEuler(transform.rotate_x, transform.rotate_y, transform.rotate_z);
    }

}
