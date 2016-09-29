/**
* @author Lianna Eeftinck / https://github.com/Leeft
*/

class MapGeometry {
  constructor({
    allSystems: allSystems,
    renderer: renderer,
    initialScale: initialScale,
  }, material) {
    this.allSystems = allSystems;
    this.renderer = renderer;
    this.initialScale = initialScale;
    this.glowMaterial = material;
  }
}

export default MapGeometry;
