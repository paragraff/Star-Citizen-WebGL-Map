/**
* @author Lianna Eeftinck / https://github.com/Leeft
*/

import MapGeometry from '../map-geometry';
import settings from '../../settings';
import config from '../../config';

import THREE from 'three';

const GLOW_MATERIAL_SYSTEM_PROMISE = new Promise(function (resolve, reject) {
  var loader = new THREE.TextureLoader();
  loader.load(config.glowImage, function (texture) {
    resolve(new THREE.PointsMaterial({
      map: texture,
      sizeAttenuation: true
    }));
  }, function (){}, function (failure) {
    reject(new Error('Could not load texture ' + config.glowImage + ': ' + failure));
  });
});

class SystemsGeometry extends MapGeometry {
  get mesh () {
    if ( this._mesh ) {
      return this._mesh;
    }

    const group = new THREE.Object3D();
    group.name = 'Star Systems Geometry';
    this._mesh = group;

    //геометрия
    var geometry = new THREE.Geometry();

    //Материал системы частиц
    var material = this.glowMaterial;

    //Система частиц


    try {
      this.allSystems.forEach( system => {
        var v = new THREE.Vector3().copy(system.position);
        geometry.vertices.push(v);
      });

      var particleSystem = new THREE.ParticleSystem(
        geometry,
        material
      );

      group.add(particleSystem);

      group.dynamic = false;
    } catch( e ) {
      console.error( `Problem creating systems geometry:`, e );
      throw e;
    }

    // Set the 2d/3d tween callback
    group.userData.scaleY = SystemsGeometry.scaleY;

    SystemsGeometry.scaleY( group, this.initialScale );
    this.refreshScale();

    return group;
  }

  refreshLOD ( camera ) {
    this._mesh.traverse( function( obj ) {
      if ( obj.userData.isLOD ) {
        obj.update( camera );
      }
    });
  }

  refreshScale () {
    this._mesh.traverse( function( obj ) {
      if ( obj.userData.isSystem ) {
        obj.scale.set( settings.systemScale, settings.systemScale, settings.systemScale );
        obj.updateMatrix();
      }
    });
  }

  static scaleY ( mesh, scaleY ) {
    mesh.scale.y = scaleY;
    mesh.updateMatrix();
  }
}

export default SystemsGeometry;
export { GLOW_MATERIAL_SYSTEM_PROMISE };
