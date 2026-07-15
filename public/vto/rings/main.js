const _settings = {
  threshold: 0.95, // detection sensitivity, between 0 and 1

  // pose computation and stabilization:
  // Ring finger landmarks (NN_RING_14)
  poseLandmarksLabels: [
    'ringBack',
    'ringLeft',
    'ringRight',
    'ringPalm',
    'ringPalmTop',
    'ringBackTop',
    'ringBase0',
    'ringBase1',
    'ringMiddleFinger',
    'ringPinkyFinger',
    'ringBasePalm'
  ],

  modelOffset: [0, 0, 0], // adjust ring position on hand
  modelScale: 0.3, // scale factor for ring model
  NNsPaths: ['./neuralNets/NN_RING_13.json'],
  objectPointsPositionFactors: [1.0, 1.0, 1.0],
  isPoseFilter: true,

  // soft occluder parameters (soft because we apply a fading gradient)
  occluderRadiusRange: [1.2, 1.5], // finger size (much smaller than wrist)
  occluderHeight: 30, // height of the cylinder (shorter for finger)
  occluderOffset: [0,0,0], // relative to the ring 3D model
  occluderQuaternion: [0.707,0,0,0.707], // rotation of Math.PI/2 along X axis
  occluderFlattenCoeff: 0.7, // 1 -> occluder is a cylinder, 0.5 -> flatten by 50%

  stabilizerOptions: {
    minCutOff: 0.001,
    beta: 4,
    freqRange: [2, 144],
    forceFilterNNInputPxRange: [2.5, 6],
  },

  // model settings:
  modelURL: window.VTO_MODEL_URL || '/models/rings/default.glb',
  modelQuaternion: [0,0,0,1], // Format: X,Y,Z,W (and not W,X,Y,Z like Blender)

  // debug flags:
  debugDisplayLandmarks: false,
  debugMeshMaterial: false,
  debugOccluder: false
};


const _states = {
  notLoaded: -1,
  loading: 0,
  idle: 1,
  running: 2,
  busy: 3
};
let _state = _states.notLoaded;
let _isInstructionsHidden = false;


function size_canvas(cv){
  const pixelRatio = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  cv.width = pixelRatio * Math.min(w, h*3/4);
  cv.height = pixelRatio * h;
}


// entry point:
function main(){
  _state = _states.loading;

  // get canvases and size them:
  const handTrackerCanvas = document.getElementById('handTrackerCanvas');
  const VTOCanvas = document.getElementById('VTOCanvas');

  size_canvas(handTrackerCanvas);
  size_canvas(VTOCanvas);

  // init change VTO button:
  ChangeCameraHelper.init({
    canvases: [handTrackerCanvas, VTOCanvas],
    DOMChangeCameraButton: document.getElementById('changeCamera')
  })

  // initialize Helper:
  HandTrackerThreeHelper.init({
    landmarksStabilizerSpec: _settings.stabilizerOptions,
    scanSettings: {
      translationScalingFactors: [0.3,0.3,1],
    },
    stabilizationSettings: {
      switchNNErrorThreshold: 0.7,
      NNSwitchMask: {
        isRightHand: true,
        isFlipped: false
      }
    },
    objectPointsPositionFactors: _settings.objectPointsPositionFactors,
    poseRotationDirectionSrc: [0,1,0],
    poseRotationDirectionDst: [0,0,1],
    poseLandmarksLabels: _settings.poseLandmarksLabels,
    poseFilter: (_settings.isPoseFilter) ? PoseFlipFilter.instance({}) : null,
    NNsPaths: _settings.NNsPaths,
    threshold: _settings.threshold,
    callbackTrack: callbackTrack,
    VTOCanvas: VTOCanvas,
    videoSettings: {
      facingMode: 'user'
    },
    handTrackerCanvas: handTrackerCanvas,
    debugDisplayLandmarks: _settings.debugDisplayLandmarks,
  }).then(start).catch(function(err){
    throw new Error(err);
  });
}


function setup_lighting(three){
  const scene = three.scene;

  const pmremGenerator = new THREE.PMREMGenerator( three.renderer );
  pmremGenerator.compileEquirectangularShader();

  new THREE.RGBELoader().setDataType( THREE.HalfFloatType )
    .load('/models/envmaps/hotel_room_1k.hdr', function ( texture ) {
    const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
    pmremGenerator.dispose();
    scene.environment = envMap;
  });

  // improve WebGLRenderer settings:
  three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  three.renderer.outputEncoding = THREE.sRGBEncoding;
}


function load_model(threeLoadingManager){
  if (_state !== _states.running && _state !== _states.idle){
    return; // model is already loaded or state is busy or loading
  }
  _state = _states.busy;

  // remove previous model but not occluders:
  HandTrackerThreeHelper.clear_threeObjects(false);

  // load new model:
  new THREE.GLTFLoader(threeLoadingManager).load(_settings.modelURL, function(model){
    const me = model.scene.children[0]; // instance of THREE.Mesh
    me.scale.set(1, 1, 1);

    // tweak the material:
    if (_settings.debugMeshMaterial){
      me.traverse(function(child){
        if (child.material){
          child.material = new THREE.MeshNormalMaterial();
        }});
    }

    // tweak position, scale and rotation:
    if (_settings.modelScale){
      me.scale.multiplyScalar(_settings.modelScale);
    }
    if (_settings.modelOffset){
      const d = _settings.modelOffset;
      const displacement = new THREE.Vector3(d[0], d[2], -d[1]); // inverse Y and Z
      me.position.add(displacement);
    }
    if (_settings.modelQuaternion){
      const q = _settings.modelQuaternion;
      me.quaternion.set(q[0], q[2], -q[1], q[3]);
    }

    // add to the tracker:
    HandTrackerThreeHelper.add_threeObject(me);

    _state = _states.running;

  });
}


function start(three){
  VTOCanvas.style.zIndex = 3; // fix a weird bug on iOS15 / safari

  setup_lighting(three);

  three.loadingManager.onLoad = function(){
    console.log('INFO in main.js: All THREE.js stuffs are loaded');
    hide_loading();
    _state = _states.running;
  }

  add_softOccluder().then(function(){
    _state = _states.idle;
  }).then(function(){
    load_model(three.loadingManager);
  });
}


function add_softOccluder(){
  // add a soft occluder (for the finger):
  const occluderRadius = _settings.occluderRadiusRange[1];
  const occluderMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(occluderRadius, occluderRadius, _settings.occluderHeight, 32, 1, true),
    new THREE.MeshNormalMaterial()
  );
  const dr = _settings.occluderRadiusRange[1] - _settings.occluderRadiusRange[0];
  occluderMesh.position.fromArray(_settings.occluderOffset);
  occluderMesh.quaternion.fromArray(_settings.occluderQuaternion);
  occluderMesh.scale.set(1.0, 1.0, _settings.occluderFlattenCoeff);
  HandTrackerThreeHelper.add_threeSoftOccluder(occluderMesh, occluderRadius, dr, _settings.debugOccluder);
  return Promise.resolve();
}


function hide_loading(){
  // Use VTO UI manager if available
  if (window.vtoUI && window.vtoUI.hideLoading) {
    window.vtoUI.hideLoading();
  } else {
    // Fallback to original behavior
    const domLoading = document.getElementById('loading');
    if (domLoading) {
      domLoading.style.opacity = 0;
      setTimeout(function(){
        domLoading.parentNode.removeChild(domLoading);
      }, 800);
    }
  }
}


function hide_instructions(){
  const domInstructions = document.getElementById('instructions');
  if (!domInstructions){
    return;
  }
  domInstructions.style.opacity = 0;
  _isInstructionsHidden = true;
  setTimeout(function(){
    domInstructions.parentNode.removeChild(domInstructions);
  }, 800);
}


function change_camera(){
  ChangeCameraHelper.change_camera();
}


function callbackTrack(detectState){
  if (detectState.isDetected) {
    if (!_isInstructionsHidden){
      hide_instructions();
    }
  }
}


window.addEventListener('load', main);
