const PI = Math.PI;
const _settings = {
  // 3D model:
  GLTFModelURL: window.VTO_MODEL_URL || '/models/earrings/default.glb',

  // lighting:
  envmapURL: '/models/envmaps/venice_sunset_512.hdr',
  pointLightIntensity: 0.8,
  pointLightY: 200, // larger -> move the pointLight to the top
  hemiLightIntensity: 0.8,

  // bloom (set to null to disable):
  bloom: {
    threshold: 0.5, //0.99,
    strength: 3,
    radius: 0.3
  },

  // temporal anti aliasing. Number of samples. 0 -> disabled:
  taaLevel: 3,

  // true -> force every mesh to polished chrome, discarding the GLB's own PBR
  // materials. See set_shinyMetal().
  forceShinyMetal: false,

  // occluder parameters:
  earsOccluderCylinderRadius: 2,
  earsOccluderCylinderHeight: 0.5, // height of the cylinder, so depth in fact
  earsOccluderCylinderOffset: [0, 1, 0], // +Y -> pull up
  earsOccluderCylinderEuler: [0,PI/6,PI/2,'XYZ'],

  // debug flags:
  debugCube: false,
  debugOccluder: false // set to true to tune earsOccluderCylinder* settings
};

const _canvases = {
  face: null,
  three: null
};

let _three = null;


function start(){
  
  // Init WebAR.rocks.face through the earrings 3D helper:
  WebARRocksFaceEarrings3DHelper.init({
    NN: './neuralNets/NN_EARS_4.json',
    taaLevel: _settings.taaLevel,
    canvasFace: _canvases.face,
    canvasThree: _canvases.three,
    debugOccluder: _settings.debugOccluder
    //,videoURL: '../../../../testVideos/1032526922-hd.mov'
  }).then(function(three){
    
    _three = three;
    if (_settings.debugCube){
      const debugCubeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(2,2,2),
          new THREE.MeshNormalMaterial()
        );
      _three.earringRight.add(debugCubeMesh);
      _three.earringLeft.add(debugCubeMesh.clone()); 
    }

    // improve WebGLRenderer settings:
    _three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _three.renderer.outputEncoding = THREE.sRGBEncoding;

    set_postprocessing();

    set_lighting();

    if (_settings.GLTFModelURL){
      load_GLTF(_settings.GLTFModelURL);
    }

    set_occluders();

    if (check_isAppleCrap()){
      WebARRocksFaceEarrings3DHelper.resize(_canvases.three.width, _canvases.three.height - 0.001);
    }
  }).catch(function(err){
    throw new Error(err);
  });
}


// return true if IOS:
function check_isAppleCrap(){
  return /iPad|iPhone|iPod/.test(navigator.platform)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}


function set_postprocessing(){
  // bloom:
  if (_settings.bloom){ // see https://threejs.org/examples/#webgl_postprocessing_unreal_bloom
    // create the bloom postprocessing pass:
    const bloom = _settings.bloom;
    const rendererSize = new THREE.Vector2();
    _three.renderer.getSize(rendererSize);
    const bloomPass = new THREE.UnrealBloomPass( rendererSize,
       bloom.strength,
       bloom.radius,
       bloom.threshold);

    _three.composer.addPass( bloomPass );
  }
}


function set_lighting(){
  if (_settings.envmapURL){
    // image based lighting:
    const pmremGenerator = new THREE.PMREMGenerator( _three.renderer );
    pmremGenerator.compileEquirectangularShader();

    new THREE.RGBELoader().setDataType( THREE.HalfFloatType )
      .load(_settings.envmapURL, function ( texture ) {
      const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
      pmremGenerator.dispose();
      _three.scene.environment = envMap;
    });

  } 
  
  // simple lighting:
  //  We add a soft light. Should not be necessary if we use an envmap:
  if (_settings.hemiLightIntensity > 0) {
    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x000000, _settings.hemiLightIntensity );
    _three.scene.add(hemiLight);
  }

  // add a pointLight to highlight specular lighting:
  if ( _settings.pointLightIntensity > 0){
    const pointLight = new THREE.PointLight( 0xffffff, _settings.pointLightIntensity );
    pointLight.position.set(0, _settings.pointLightY, 0);
    _three.scene.add(pointLight);
  }
}


function load_GLTF(modelURL){
  new THREE.GLTFLoader().load(modelURL, function(gltf){
    const model = gltf.scene;
    model.scale.multiplyScalar(100); // because the model is exported in meters. convert it to cm

    if (_settings.forceShinyMetal){
      set_shinyMetal(model);
    }

    // A pair of earrings is a MIRROR pair, so the left ear cannot be a plain
    // clone of the right one — that gives both ears the same handedness, which
    // is visibly wrong for anything asymmetric (a hook, a drop with a clasp).
    // The page-wide CSS mirror does not hide it: it flips both ears equally,
    // so it cannot fix the relationship BETWEEN them.
    //
    // create_earringLeftFromEarringRight() mirrors the geometry and reverses
    // the face winding so the normals still point outwards. It builds its
    // mirror matrix from each mesh's matrixWorld, which forces the order here:
    //   - matrixWorld has to be current, and a freshly loaded GLTF node's is not;
    //   - the model has to still be DETACHED, so "mirror about world x=0" means
    //     "mirror the earring about its own origin". Once it is parented to
    //     earringRight, matrixWorld carries the ear's ~11cm offset and the
    //     mirror plane is no longer the one we want.
    model.updateMatrixWorld(true);
    const modelLeft = WebARRocksFaceEarrings3DHelper.create_earringLeftFromEarringRight(model);

    _three.earringRight.add(model);
    _three.earringLeft.add(modelLeft);
  });
}


// Opt-in, and off by default: this overwrites whatever the GLB's author set up.
// A jewellery catalogue is exactly the case where that hurts — gemstones,
// pearls, enamel and rose-vs-white gold all collapse into the same chrome
// mirror. Turn it on for a model that ships with untextured placeholder
// materials and only looks like metal because of this override.
function set_shinyMetal(model){
  model.traverse(function(threeStuff){
    if (!threeStuff.isMesh){
      return;
    }
    const mat = threeStuff.material;
    mat.roughness = 0.0;
    mat.metalness = 1.0;
  });
}


function set_occluders(){
  const occluderRightGeom = new THREE.CylinderGeometry(_settings.earsOccluderCylinderRadius, _settings.earsOccluderCylinderRadius, _settings.earsOccluderCylinderHeight);
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler().fromArray(_settings.earsOccluderCylinderEuler));
  matrix.setPosition(new THREE.Vector3().fromArray(_settings.earsOccluderCylinderOffset));
  occluderRightGeom.applyMatrix4(matrix);
  WebARRocksFaceEarrings3DHelper.add_threeEarsOccluders(occluderRightGeom);
}


function main(){
  // get the 2 canvas from the DOM:
  _canvases.face = document.getElementById('WebARRocksFaceCanvas');
  _canvases.three = document.getElementById('threeCanvas');

  // Set the canvas to fullscreen
  // and add an event handler to capture window resize:
  WebARRocksResizer.size_canvas({
    isFullScreen: false,
    canvas: _canvases.face,     // WebARRocksFace main canvas
    overlayCanvas: [_canvases.three], // other canvas which should be resized at the same size of the main canvas
    callback: start,
    onResize: WebARRocksFaceEarrings3DHelper.resize
  })
}


window.addEventListener('load', main);