import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ─── SCENE ───────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

// ─── RENDERER ────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ─── KAMERA ──────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

// ─── LIGHTING ────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(4, 15, 4);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far  = 100;
dirLight.shadow.camera.left   = -30;
dirLight.shadow.camera.right  =  30;
dirLight.shadow.camera.top    =  30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.radius = 3;
dirLight.shadow.bias   = -0.001;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(0, 5, 0);
scene.add(fillLight);

const sideLight = new THREE.DirectionalLight(0xffffff, 0.4);
sideLight.position.set(10, 5, 0);
scene.add(sideLight);

const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
sideLight2.position.set(-10, 5, 0);
scene.add(sideLight2);

// ─── STATE ───────────────────────────────────────────
const keys = {};
var lantaiSaatIni = 1;
let yaw = 0;
let pitch = 0;
let isMouseDown = false;
let currentFloorY = 1;
let modelAktif = 1;

const raycasterKlik = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ─── CACHE SEMUA MODEL ───────────────────────────────
// Struktur: loadedModels[nomorModel] = {
//   scene: THREE.Group,
//   collisionMeshes: [],
//   objekPositions: {},
//   floorMarkers: {},
// }
const loadedModels = {};

// Collision & objek aktif (diambil dari model yang sedang ditampilkan)
let collisionMeshes = [];
const objekPositions = {};

const floorMarkers = {
  lantai1: null, lantai2: null, lantai3: null,
  lantai4: null, lantai5: null, lantai6: null, lantai7: null,
};

// ─── LOAD DATA OBJEK ─────────────────────────────────
let objekData = {};
fetch('./objek.json')
  .then(res => res.json())
  .then(data => {
    objekData = data;
    console.log('✅ Data objek berhasil dimuat');
  })
  .catch(err => console.error('❌ Gagal load objek.json:', err));

// ─── LOADER GLB ──────────────────────────────────────
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// ─── MODEL CONFIG ─────────────────────────────────────
const modelConfig = {
  1: {
    file: '../Asset/3D/lantai1_2.glb',
    spawnMarker: 'Marker_Awal',
    prefixes: ['L1_', 'L2_'],
    lantaiTersedia: [1, 2],
    markerOffsets: {
      'Marker_Awal':    Math.PI / 2,
      'Marker_Lantai1': Math.PI / -1.5,
      'Marker_Lantai2': Math.PI / 25,
    }
  },
  2: {
    file: '../Asset/3D/lantai3_4.glb',
    spawnMarker: 'Marker_Lantai3',
    prefixes: ['L3_', 'L4_'],
    lantaiTersedia: [3, 4],
    markerOffsets: {
      'Marker_Lantai3': Math.PI / 3,
      'Marker_Lantai4': Math.PI / -1.8,
    }
  },
  3: {
    file: '../Asset/3D/Lantai5_7.glb',
    spawnMarker: 'Marker_Lantai5',
    prefixes: ['L5_', 'L6_', 'L7_'],
    lantaiTersedia: [5, 6, 7],
    markerOffsets: {
      'Marker_Lantai5': Math.PI / -1,
      'Marker_Lantai6': Math.PI / -1,
      'Marker_Lantai7': Math.PI / -1,
    }
  },
};

// ─── UPDATE TOMBOL LANTAI ─────────────────────────────
function updateTombolLantai() {
  document.querySelectorAll('.btn-lantai').forEach(function(btn) {
    btn.classList.remove('aktif');
  });
  var btnAktif = document.getElementById('btn-lantai' + lantaiSaatIni);
  if (btnAktif) btnAktif.classList.add('aktif');
}

// ─── PARSE SATU MODEL GLB (tanpa menambahkan ke scene) ───
function parseModel(nomorModel, gltf) {
  var config = modelConfig[nomorModel];
  var modelScene = gltf.scene;

  var data = {
    scene: modelScene,
    collisionMeshes: [],
    objekPositions: {},
    floorMarkers: {
      lantai1: null, lantai2: null, lantai3: null,
      lantai4: null, lantai5: null, lantai6: null, lantai7: null,
    },
  };

  modelScene.traverse(function(child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        var mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(function(mat) {
          if (mat.opacity < 1 || mat.transparent) {
            mat.transparent = true;
            mat.depthWrite = false;
            mat.side = THREE.DoubleSide;
          }
        });
      }

      // Collision: semua mesh yang bukan artifact
      var par = child;
      var isArtifact = false;
      while (par) {
        if (config.prefixes.some(function(p) { return par.name.startsWith(p); })) {
          isArtifact = true;
          break;
        }
        par = par.parent;
      }
      if (!isArtifact) data.collisionMeshes.push(child);

      // Posisi objek interaktif
      var par2 = child;
      while (par2) {
        if (config.prefixes.some(function(p) { return par2.name.startsWith(p); })) {
          if (!data.objekPositions[par2.name]) {
            var box = new THREE.Box3().setFromObject(par2);
            var center = new THREE.Vector3();
            box.getCenter(center);
            data.objekPositions[par2.name] = {
              x: center.x,
              y: box.max.y - 0.3,
              z: center.z,
            };
          }
          break;
        }
        par2 = par2.parent;
      }
    }

    // Floor markers
    ['1','2','3','4','5','6','7'].forEach(function(n) {
      if (child.name === 'Marker_Lantai' + n) {
        var d = new THREE.Euler().setFromQuaternion(child.quaternion, 'YXZ');
        var markerName = 'Marker_Lantai' + n;
        var markerOffset = Math.PI / 2;
        if (config.markerOffsets && config.markerOffsets[markerName]) {
          markerOffset = config.markerOffsets[markerName];
        }
        data.floorMarkers['lantai' + n] = {
          x: child.position.x,
          y: child.position.y + 1,
          z: child.position.z,
          yaw: d.y + markerOffset,
          pitch: d.x,
        };
      }
    });

    // Marker_Awal (hanya model 1)
    if (child.name === 'Marker_Awal') {
      var direction = new THREE.Euler().setFromQuaternion(child.quaternion, 'YXZ');
      var spawnOffset = (config.markerOffsets && config.markerOffsets['Marker_Awal'])
        ? config.markerOffsets['Marker_Awal']
        : Math.PI / 2;
      data.floorMarkers['awal'] = {
        x: child.position.x,
        y: child.position.y + 1.2,
        z: child.position.z,
        yaw: direction.y + spawnOffset,
        pitch: direction.x,
      };
    }
  });

  // Semua model disembunyikan dulu setelah di-parse
  modelScene.visible = false;
  scene.add(modelScene);

  loadedModels[nomorModel] = data;
  console.log('✅ Model', nomorModel, 'berhasil di-parse dan disimpan ke cache');
}

// ─── PRELOAD SEMUA MODEL ─────────────────────────────
function preloadSemuaModel(onSelesai) {
  var loading = document.getElementById('loading-screen');
  var progressEl = document.getElementById('progress');
  var progressText = document.getElementById('progress-text');

  loading.style.display = 'flex';
  progressEl.style.width = '0%';

  var totalModel = Object.keys(modelConfig).length; // 3
  var progressPerModel = {}; // { 1: 0, 2: 0, 3: 0 }
  var selesai = 0;

  Object.keys(modelConfig).forEach(function(key) {
    progressPerModel[key] = 0;
  });

  function updateProgress() {
    var total = 0;
    Object.values(progressPerModel).forEach(function(v) { total += v; });
    var persen = Math.round(total / totalModel);
    progressEl.style.width = persen + '%';
    if (progressText) progressText.textContent = 'Memuat model... ' + persen + '%';
  }

  Object.keys(modelConfig).forEach(function(key) {
    var nomorModel = parseInt(key);
    var config = modelConfig[nomorModel];

    loader.load(
      config.file,
      function(gltf) {
        progressPerModel[key] = 100;
        updateProgress();
        parseModel(nomorModel, gltf);
        selesai++;
        if (selesai === totalModel) {
          loading.style.display = 'none';
          console.log('✅ Semua model berhasil di-preload');
          onSelesai();
        }
      },
      function(xhr) {
        if (xhr.total > 0) {
          progressPerModel[key] = (xhr.loaded / xhr.total) * 100;
          updateProgress();
        }
      },
      function(error) {
        console.error('❌ Gagal load model', key, ':', error);
        // Tetap lanjut meski satu model gagal
        progressPerModel[key] = 100;
        updateProgress();
        selesai++;
        if (selesai === totalModel) {
          loading.style.display = 'none';
          onSelesai();
        }
      }
    );
  });
}

// ─── AKTIVASI MODEL (show/hide, swap collision & objek) ──
function aktivasiModel(nomorModel) {
  // Sembunyikan semua model
  Object.keys(loadedModels).forEach(function(key) {
    loadedModels[key].scene.visible = false;
  });

  // Tampilkan model yang dipilih
  var data = loadedModels[nomorModel];
  if (!data) {
    console.error('❌ Model', nomorModel, 'tidak ada di cache!');
    return;
  }
  data.scene.visible = true;
  modelAktif = nomorModel;

  // Swap collision meshes
  collisionMeshes.length = 0;
  data.collisionMeshes.forEach(function(m) { collisionMeshes.push(m); });

  // Swap objek positions
  Object.keys(objekPositions).forEach(function(k) { delete objekPositions[k]; });
  Object.assign(objekPositions, data.objekPositions);

  // Sync floor markers global
  Object.keys(floorMarkers).forEach(function(k) { floorMarkers[k] = null; });
  Object.assign(floorMarkers, data.floorMarkers);

  // Update marker DOM
  document.querySelectorAll('.marker-objek').forEach(function(m) { m.remove(); });
  setTimeout(function() {
    Object.keys(objekData).forEach(function(nama) {
      if (objekPositions[nama]) {
        var marker = buatMarker(nama, objekData[nama], objekPositions[nama]);
        marker.dataset.nama = nama;
      }
    });
  }, 100);

  console.log('✅ Model aktif diubah ke:', nomorModel);
}

// ─── TELEPORTASI ─────────────────────────────────────
function teleportTo(marker) {
  if (!marker) return;
  var overlay = document.getElementById('fade-overlay');
  overlay.style.opacity = '1';
  setTimeout(function() {
    camera.position.set(marker.x, marker.y, marker.z);
    currentFloorY = marker.y;
    yaw   = marker.yaw;
    pitch = marker.pitch;
    overlay.style.opacity = '0';
    updateTombolLantai();
  }, 300);
}

// ─── PINDAH LANTAI (tanpa loading) ───────────────────
function pindahLantai(lantai) {
  lantaiSaatIni = lantai;

  // Tentukan model mana yang memiliki lantai ini
  var targetModel = null;
  Object.keys(modelConfig).forEach(function(key) {
    if (modelConfig[key].lantaiTersedia.indexOf(lantai) !== -1) {
      targetModel = parseInt(key);
    }
  });

  if (targetModel === null) {
    console.warn('Lantai', lantai, 'tidak ditemukan di model manapun');
    return;
  }

  // Jika model berbeda, aktifkan model baru terlebih dahulu
  if (targetModel !== modelAktif) {
    aktivasiModel(targetModel);
  }

  // Tentukan marker tujuan
  var markerKey = lantai === 1 && loadedModels[targetModel].floorMarkers['awal']
    ? 'awal'
    : 'lantai' + lantai;

  var marker = floorMarkers[markerKey];

  if (marker) {
    teleportTo(marker);
  } else {
    console.warn('Marker untuk lantai', lantai, 'tidak ditemukan');
    updateTombolLantai();
  }
}

// ─── TOMBOL LANTAI ───────────────────────────────────
document.getElementById('btn-lantai1').addEventListener('click', function() { pindahLantai(1); });
document.getElementById('btn-lantai2').addEventListener('click', function() { pindahLantai(2); });
document.getElementById('btn-lantai3').addEventListener('click', function() { pindahLantai(3); });
document.getElementById('btn-lantai4').addEventListener('click', function() { pindahLantai(4); });
document.getElementById('btn-lantai5').addEventListener('click', function() { pindahLantai(5); });
document.getElementById('btn-lantai6').addEventListener('click', function() { pindahLantai(6); });
document.getElementById('btn-lantai7').addEventListener('click', function() { pindahLantai(7); });

// ─── KEYBOARD ────────────────────────────────────────
document.addEventListener('keydown', function(e) { keys[e.code] = true; });
document.addEventListener('keyup',   function(e) { keys[e.code] = false; });

// ─── RESIZE ──────────────────────────────────────────
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── PANEL INFO ──────────────────────────────────────
function tampilkanPanel(id, data) {
  document.getElementById('panel-nama').textContent      = data.nama;
  document.getElementById('panel-tahun').textContent     = data.tahun;
  document.getElementById('panel-asal').textContent      = data.asal;
  document.getElementById('panel-deskripsi').textContent = data.deskripsi;
  document.getElementById('info-panel').style.display    = 'flex';
}

document.getElementById('panel-tutup').addEventListener('click', function() {
  document.getElementById('info-panel').style.display = 'none';
});

// ─── MOUSE ───────────────────────────────────────────
canvas.addEventListener('mousedown', function() {
  isMouseDown = true;
  canvas.style.cursor = 'none';
});

canvas.addEventListener('mouseup', function() {
  isMouseDown = false;
  canvas.style.cursor = 'default';
});

document.addEventListener('mousemove', function(e) {
  if (!isMouseDown) return;
  var sensitivity = 0.002;
  yaw   -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
});

// ─── SWIPE KAMERA MOBILE ─────────────────────────────
var lookTouch = { active: false, startX: 0, startY: 0, id: null };

canvas.addEventListener('touchstart', function(e) {
  var touch = e.changedTouches[0];
  lookTouch = { active: true, startX: touch.clientX, startY: touch.clientY, id: touch.identifier };
}, { passive: true });

canvas.addEventListener('touchmove', function(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    var touch = e.changedTouches[i];
    if (touch.identifier === lookTouch.id) {
      var sensitivity = 0.004;
      yaw   -= (touch.clientX - lookTouch.startX) * sensitivity;
      pitch -= (touch.clientY - lookTouch.startY) * sensitivity;
      pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
      lookTouch.startX = touch.clientX;
      lookTouch.startY = touch.clientY;
    }
  }
}, { passive: true });

canvas.addEventListener('touchend', function(e) {
  lookTouch = { active: false, startX: 0, startY: 0, id: null };
}, { passive: true });

// ─── TOMBOL ARAH MOBILE ───────────────────────────────
var mobileKeys = { maju: false, mundur: false, kiri: false, kanan: false };

function daftarTombolMobile(idBtn, arah) {
  var btn = document.getElementById(idBtn);
  if (!btn) return;
  btn.addEventListener('touchstart', function(e) {
    e.stopPropagation();
    mobileKeys[arah] = true;
  }, { passive: true });
  btn.addEventListener('touchend', function(e) {
    e.stopPropagation();
    mobileKeys[arah] = false;
  }, { passive: true });
}

daftarTombolMobile('btn-maju',   'maju');
daftarTombolMobile('btn-mundur', 'mundur');
daftarTombolMobile('btn-kiri',   'kiri');
daftarTombolMobile('btn-kanan',  'kanan');

// ─── COLLISION DETECTION ─────────────────────────────
var PLAYER_HEIGHT = 1;
var PLAYER_RADIUS = 0.4;
var raycasterWall = new THREE.Raycaster();
var wallDirections = [
  new THREE.Vector3( 1, 0,  0),
  new THREE.Vector3(-1, 0,  0),
  new THREE.Vector3( 0, 0,  1),
  new THREE.Vector3( 0, 0, -1),
];

function checkCollision(nextPos) {
  var origin = new THREE.Vector3(nextPos.x, nextPos.y - 0.5, nextPos.z);
  for (var i = 0; i < wallDirections.length; i++) {
    raycasterWall.set(origin, wallDirections[i]);
    var hits = raycasterWall.intersectObjects(collisionMeshes, true);
    if (hits.length > 0 && hits[0].distance < PLAYER_RADIUS) {
      return true;
    }
  }
  return false;
}

// ─── FULLSCREEN ───────────────────────────────────────
var btnFullscreen = document.getElementById('btn-fullscreen');
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', function() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      btnFullscreen.textContent = '✕';
    } else {
      document.exitFullscreen();
      btnFullscreen.textContent = '⛶';
    }
  });

  document.addEventListener('fullscreenchange', function() {
    btnFullscreen.textContent = document.fullscreenElement ? '✕' : '⛶';
  });
}

// ─── MARKER OBJEK ────────────────────────────────────
function buatMarker(nama, data, posisi3D) {
  var marker = document.createElement('div');
  marker.className = 'marker-objek';
  marker.innerHTML =
    '<div class="marker-icon">' +
      '<img src="./Foto/info.png" width="36" height="36"/>' +
    '</div>' +
    '<div class="marker-card">' +
      '<strong>' + (data.nama || '-') + '</strong>' +
      '<p>' + (data.deskripsi ? data.deskripsi.substring(0, 60) : '-') + '...</p>' +
      '<button class="marker-btn">Lihat Detail</button>' +
    '</div>';

  marker.querySelector('.marker-btn').addEventListener('click', function() {
    tampilkanPanel(nama, data);
  });
  document.body.appendChild(marker);
  return marker;
}

function updateMarkers() {
  document.querySelectorAll('.marker-objek').forEach(function(marker) {
    var nama = marker.dataset.nama;
    var pos = objekPositions[nama];
    if (!pos) return;

    var jarak = camera.position.distanceTo(new THREE.Vector3(pos.x, pos.y, pos.z));
    if (jarak > 3) { marker.style.display = 'none'; return; }

    var vector = new THREE.Vector3(pos.x, pos.y, pos.z);
    vector.project(camera);
    if (vector.z > 1) { marker.style.display = 'none'; return; }

    var x = (vector.x *  0.5 + 0.5) * window.innerWidth;
    var y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    marker.style.display = 'block';
    marker.style.left = x + 'px';
    marker.style.top  = y + 'px';
  });
}

// ─── UPDATE GERAK ────────────────────────────────────
var clock = new THREE.Clock();
var moveDir = new THREE.Vector3();

function updateMovement() {
  var delta = clock.getDelta();
  var speed = 4;

  var forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  var right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));

  moveDir.set(0, 0, 0);

  if (keys['KeyW'] || keys['ArrowUp'])    moveDir.addScaledVector(forward,  1);
  if (keys['KeyS'] || keys['ArrowDown'])  moveDir.addScaledVector(forward, -1);
  if (keys['KeyA'] || keys['ArrowLeft'])  moveDir.addScaledVector(right,   -1);
  if (keys['KeyD'] || keys['ArrowRight']) moveDir.addScaledVector(right,    1);

  if (mobileKeys.maju)   moveDir.addScaledVector(forward,  1);
  if (mobileKeys.mundur) moveDir.addScaledVector(forward, -1);
  if (mobileKeys.kiri)   moveDir.addScaledVector(right,   -1);
  if (mobileKeys.kanan)  moveDir.addScaledVector(right,    1);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    var nextPos = camera.position.clone().addScaledVector(moveDir, speed * delta);
    nextPos.y = currentFloorY;
    if (!checkCollision(nextPos)) {
      camera.position.copy(nextPos);
    }
  }

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

// ─── RENDER LOOP ─────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  updateMarkers();
  renderer.render(scene, camera);
}

// ─── MULAI: PRELOAD SEMUA → AKTIFKAN MODEL 1 ─────────
preloadSemuaModel(function() {
  // Aktifkan model 1 dan spawn di Marker_Awal
  aktivasiModel(1);

  var markerAwal = floorMarkers['awal'];
  if (markerAwal) {
    camera.position.set(markerAwal.x, markerAwal.y, markerAwal.z);
    currentFloorY = markerAwal.y;
    yaw   = markerAwal.yaw;
    pitch = markerAwal.pitch;
  }

  lantaiSaatIni = 1;
  updateTombolLantai();

  // Sembunyikan overlay fade jika masih aktif
  var overlay = document.getElementById('fade-overlay');
  if (overlay) overlay.style.opacity = '0';

  animate();
});