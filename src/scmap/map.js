/**
* @author Lianna Eeftinck / https://github.com/Leeft
*/

import SCMAP from '../scmap';
import StarSystem from './star-system';
import Goods from './goods';
import Stars from '../helpers/mapGenerator';
import Faction from './faction';
import Dijkstra from './dijkstra';
import Route from './route';
import UI from './ui';
import config from './config';
import settings from './settings';
import xhrPromise from '../helpers/xhr-promise';
import { hasLocalStorage, hasSessionStorage } from '../helpers/functions';
import { renderer, scene } from '../starcitizen-webgl-map';
import DisplayState from './map/display-state';
import waitForFontAwesome from '../helpers/wait-for-font-awesome';
import { Scene, Mesh, MeshBasicMaterial, Vector3 } from './three';
import { degToRad } from './three/math';

import SelectedSystemGeometry from './map/geometry/selector';
import { buildReferenceGrid } from './map/geometry/basic-grid';
import SystemsGeometry from './map/geometry/systems';
import JumpPoints from './map/geometry/jump-points';
import SystemLabels from './map/geometry/system-labels';
import Interactables from './map/geometry/interactables';
import SystemGlow, { GLOW_MATERIAL_PROMISE } from './map/geometry/system-glow';

import TWEEN from 'tween.js';
import RSVP from 'rsvp';

function scaleSelector( mesh, scaleY ) {
  mesh.scale.y = scaleY * 4.0 * config.renderScale;
  mesh.position.setY( scaleY * mesh.userData.position.y );
}

class Map {
  constructor () {
    this.name = `Star Citizen Persistent Universe`;
    this.scene = new Scene();

    this._route = null; // The main route the user can set

    this.geometry = {};
    this.displayState = this.buildDisplayState();

    this.geometry.selectedSystem = this._createSelectorObject( 0x99FF99 );
    this.geometry.selectedSystem.userData.scaleY = scaleSelector;
    scaleSelector( this.geometry.selectedSystem, this.displayState.currentScale );
    this.scene.add( this.geometry.selectedSystem );

    this.geometry.mouseOverObject = this._createSelectorObject( 0x8844FF );
    this.geometry.mouseOverObject.scale.set( 4.0 * config.renderScale, 4.0 * config.renderScale, 4.0 * config.renderScale );
    this.geometry.mouseOverObject.userData.scaleY = scaleSelector;
    scaleSelector( this.geometry.mouseOverObject, this.displayState.currentScale );
    this.scene.add( this.geometry.mouseOverObject );

    this.__currentlySelected = null;

    const map = this;

    const getSystems          = Promise.resolve(new Stars().generate()); // xhrPromise( config.systemsJson );
    const getStrategicValues  = xhrPromise( config.strategicValuesJson );
    const getFactions         = xhrPromise( config.factionsJson );
    const getCrimeLevels      = xhrPromise( config.crimeLevelsJson );
    const getGoods            = xhrPromise( config.goodsJson );

    RSVP.all([
      getSystems,
      getStrategicValues,
      getFactions,
      getCrimeLevels,
      getGoods,
    ]).then( function( promises ) {

      getStrategicValues.then( strategic_values => { SCMAP.importUEEStrategicValues( JSON.parse( strategic_values ) ) } );
      getCrimeLevels.then( crimeLevels => { SCMAP.importCrimeLevels( JSON.parse( crimeLevels ) ) } );

      getFactions.then( factions => { SCMAP.importFactions( JSON.parse( factions ) ) } );
      getGoods.then( goods => { SCMAP.importCommodities( JSON.parse( goods ) ) } );

      getSystems.then( systems => {
        try {
         //systems = JSON.parse( systems );
          map.populate( systems );
        } catch( e ) {
          console.error( `Could not populate map:`, e );
          throw e;
        };

       /* try {
          const grid = buildReferenceGrid();
          grid.name = 'referenceGrid';
          map.scene.add( grid );
          grid.position.y = -0.05;
          grid.updateMatrix();
        } catch( e ) {
          console.error( `Failed to create reference grid:`, e );
        };*/

        UI.updateSystemsList();
       // renderer.controls.idle();

       /* map.route().restoreFromSession();
        map.route().update();*/

        if ( 'selectedSystem' in settings.storage ) {
          let selectedSystem = StarSystem.getById( settings.storage.selectedSystem );
          if ( selectedSystem instanceof StarSystem ) {
            map.setSelectionTo( selectedSystem );
            UI.displayInfoOn( selectedSystem, true );
          }
        }

      }, failed => {
        console.error( 'Failed to process systems', failed );
      });

    }, ( failure ) => {
      console.error( `Failed loading data:`, failure );
    });
  }

  buildDisplayState () {
    const displayState = new DisplayState({
      mode: settings.mode,
      map: this,
      time: config.time,
    });

    displayState.onUpdate = ( value ) => {
      this.scene.children.forEach( mesh => {
        if ( typeof mesh.userData.scaleY === 'function' ) {
          mesh.userData.scaleY( mesh, value );
        }
      });
    };

    displayState.onEnter2D = function () {
      UI.entered2D();
      settings.mode = '2d';
    };

    displayState.onEnter3D = function () {
      UI.entered3D();
      settings.mode = '3d';
    };

    this.displayState = displayState;

    if ( config.debug ) {
      console.info( 'DisplayState is', displayState );
    }

    return displayState;
  }

  getSelected () {
    return this.__currentlySelected;
  }

  selected () {
    return this.getSelected();
  }

  animate () {
    let rotationY = degToRad( Date.now() * 0.00025 ) * 300;
    this.scene.traverse( function ( object ) {
      if ( object.userData.isSelector ) {
        object.rotation.y = rotationY;
      }
    });
  }

  setSelected ( system ) {
    if ( system !== null && ! ( system instanceof StarSystem ) ) {
      throw new Error( system, 'is not an instance of StarSystem' );
    }
    this.__currentlySelected = system;
    if ( system ) {
      settings.storage.selectedSystem = system.id;
    } else {
      delete settings.storage.selectedSystem;
    }
    return system;
  }

  _createSelectorObject ( color ) {
    let mesh = new Mesh( SelectedSystemGeometry, new MeshBasicMaterial({ color: color }) );
    mesh.scale.set( 4.2 * config.renderScale, 4.2 * config.renderScale, 4.2 * config.renderScale );
    mesh.visible = false;
    mesh.userData.isSelector = true;
    // 2d/3d tween callback
    mesh.userData.position = new Vector3( 0, 0, 0 );
    mesh.userData.scaleY = function ( object, scalar ) {
      object.position.setY( object.userData.position.y * scalar );
    };
    return mesh;
  }

  __updateSelectorObject ( system ) {
    if ( system instanceof StarSystem ) {
      this.geometry.selectedSystem.visible = true;
      this.geometry.selectedSystem.userData.position.copy( system.position );
      this.moveSelectorTo( system );
      this.setSelected( system );
    } else {
      this.geometry.selectedSystem.visible = false;
      this.setSelected( null );
    }
  }

  // Lazy builds the route
  /*route () {
    if ( !( this._route instanceof Route ) ) {
      this._route = new Route();
      if ( config.debug ) {
        console.log( 'Created new route', this._route.toString() );
      }
    }

    return this._route;
  }*/

  setSelectionTo ( system ) {
    return this.__updateSelectorObject( system );
  }

  deselect () {
    return this.__updateSelectorObject();
  }

  setAllLabelSizes ( vector ) {
    SCMAP.allSystems.forEach( system => {
      system.setLabelScale( vector );
    });
  }

  moveSelectorTo ( destination ) {
    const map = this;
    let tween, newPosition, position, poi, graph, route;
    let tweens = [];

    if ( ! ( this.geometry.selectedSystem.visible ) || ! ( this.getSelected() instanceof StarSystem ) ) {
      this.geometry.selectedSystem.userData.position.copy( destination.position );
      this.geometry.selectedSystem.position.copy( destination.position );
      this.geometry.selectedSystem.position.setY( destination.position.y * this.displayState.currentScale );
      this.geometry.selectedSystem.visible = true;
      this.getSelected( destination );
      return;
    }

    newPosition = destination.position.clone();
    graph = new Dijkstra( SCMAP.allSystems, this.getSelected(), destination );
    graph.buildGraph();

    route = graph.routeArray( destination );
    if ( route.length <= 1 ) {
      this.geometry.selectedSystem.userData.position.copy( destination.position );
      this.geometry.selectedSystem.position.copy( destination.position );
      this.geometry.selectedSystem.position.setY( destination.position.y * this.displayState.currentScale );
      this.geometry.selectedSystem.visible = true;
      this.setSelected( destination );
      return;
    }

    position = {
      x: this.geometry.selectedSystem.position.x,
      y: this.geometry.selectedSystem.position.y * this.displayState.currentScale,
      z: this.geometry.selectedSystem.position.z
    };

    /* jshint ignore:start */
    for ( let i = 0; i < route.length - 1; i++ ) {
      poi = route[ i + 1 ].system;

      tween = new TWEEN.Tween( position )
        .to( {
          x: poi.position.x,
          y: poi.position.y * this.displayState.currentScale,
          z: poi.position.z
        }, 800 / ( route.length - 1 ) )
      .easing( TWEEN.Easing.Linear.None )
        .onUpdate( function () {
          map.geometry.selectedSystem.position.set( this.x, this.y, this.z );
        } );

      if ( i == 0 ) {
        if ( route.length == 2 ) {
          tween.easing( TWEEN.Easing.Cubic.InOut );
        } else {
          tween.easing( TWEEN.Easing.Cubic.In );
        }
      }

      if ( i > 0 ) {
        tweens[ i - 1 ].chain( tween );
      }

      if ( i == route.length - 2 ) {
        tween.easing( TWEEN.Easing.Cubic.Out );
        tween.onComplete( function() {
          map.geometry.selectedSystem.userData.position.copy( poi.position );
          map.geometry.selectedSystem.position.copy( poi.position );
          map.geometry.selectedSystem.position.setY( destination.position.y * map.displayState.currentScale );
          map.setSelected( destination );
        } );
      }

      tweens.push( tween );
    }
    /* jshint ignore:end */

    tweens[0].start();
  }

  getIntersect ( event ) {
    return this.geometry.interactables.getIntersect( event );
  }

  syncCamera () {
    renderer.controls.rememberPosition();
    this.geometry.systems.refreshLOD( renderer.camera );
    this.geometry.labels.matchRotation( renderer.cameraRotationMatrix() );
  }

  populate ( data ) {
    const startTime = new Date().getTime();

    SCMAP.importStarSystems( data );

    const standardGeometryParameters = {
      allSystems: SCMAP.allSystems,
      renderer: renderer,
      initialScale: this.displayState.currentScale,
    };

    // Generate an object for the star systems
    this.geometry.systems = new SystemsGeometry( standardGeometryParameters );
    this.scene.add( this.geometry.systems.mesh );

    waitForFontAwesome().then( () => {
      // Generate the labels for the star systems
      this.geometry.labels = new SystemLabels( standardGeometryParameters );
      this.scene.add( this.geometry.labels.mesh );
    });

    // Generate the proxy sprites for mouse/touch interaction
    this.geometry.interactables = new Interactables( standardGeometryParameters );
    this.scene.add( this.geometry.interactables.mesh );

    // Generate an object for the jump points
    let jumpPointsCount = data.filter(system => system.jumpPoints && system.jumpPoints.length).length;
    if (jumpPointsCount) {
      this.geometry.jumpPoints = new JumpPoints( standardGeometryParameters );
      this.scene.add( this.geometry.jumpPoints.mesh );
    }

    // Glow sprites for the systems
    GLOW_MATERIAL_PROMISE.then( material => {
      standardGeometryParameters.material = material;
      this.geometry.glow = new SystemGlow( standardGeometryParameters );
      this.scene.add( this.geometry.glow.mesh );
    });

    console.info( `Populating the scene took ${ new Date().getTime() - startTime } msec` );

    UI.loadedSystems( SCMAP.allSystems.length );
  }

  pointAtPlane ( theta, radius, y ) {
    return new Vector3( radius * Math.cos( theta ), y, -radius * Math.sin( theta ) );
  }
}

export default Map;
