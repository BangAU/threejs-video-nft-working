function isMobile() {
    return /Android|mobile|iPad|iPhone/i.test(navigator.userAgent);
}

var interpolationFactor = 24;

var trackedMatrix = {
  // for interpolation
  delta: [
      0,0,0,0,
      0,0,0,0,
      0,0,0,0,
      0,0,0,0
  ],
  interpolated: [
      0,0,0,0,
      0,0,0,0,
      0,0,0,0,
      0,0,0,0
  ]
}

var markers = {
    "pinball": {
        url: "./examples/DataNFT/somfycover",
    },
};

var setMatrix = function (matrix, value) {
    var array = [];
    for (var key in value) {
        array[key] = value[key];
    }
    if (typeof matrix.elements.set === "function") {
        matrix.elements.set(array);
    } else {
        matrix.elements = [].slice.call(array);
    }
};

function start(container, marker, video, input_width, input_height, canvas_draw, render_update, track_update, greyCover) {
    var vw, vh;
    var sw, sh;
    var pscale, sscale;
    var w, h;
    var pw, ph;
    var ox, oy;
    var worker;
    var camera_para = './../examples/Data/camera_para-iPhone 5 rear 640x480 1.0m.dat'



    // var video = document.createElement('video');
    // video.src = "../../../css/images/somfy-ar.mp4";
    // video.load();

    var canvas_process = document.createElement('canvas');
    var context_process = canvas_process.getContext('2d');

    var renderer = new THREE.WebGLRenderer({ canvas: canvas_draw, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.useQuaternion = true;

    camera.matrixAutoUpdate = true;
    camera.useQuaternion = true;

    scene.add(camera);

    camera.updateProjectionMatrix();

    var spheretexture = new THREE.Texture(canvas_process);

    var material = new THREE.MeshLambertMaterial( { color: 0xbbbbff, map: spheretexture, overdraw: 0.5 } );

    var sphere1 = new THREE.PlaneGeometry(1,1,1,1);

    //make a mesh from the material and the geometry (the sphere)
    var sphereMesh = new THREE.Mesh(sphere1, material);

    var sphere = new THREE.Mesh(
        sphere1,
        sphereMesh
    );


    var root = new THREE.Object3D();
    root.position.set(0, 0, 0);
    scene.add(root);
    
    sphere.material.flatShading;
    sphere.position.z = 0;
    sphere.position.x = 90;
    sphere.position.y = 90;
    sphere.scale.set(180, 180, 180);

    root.matrixAutoUpdate = true;
    sphere.geometry.center();

    root.add(sphere);
    


    
    var el = document.querySelector("#video-data");
    el.pause();
    

    var load = function() {
        vw = input_width;
        vh = input_height;

        pscale = 320 / Math.max(vw, vh / 3 * 4);
        sscale = isMobile() ? window.outerWidth / input_width : 1;

        sw = vw * sscale;
        sh = vh * sscale;
        video.style.width = sw + "px";
        video.style.height = sh + "px";
        container.style.width = sw + "px";
        container.style.height = sh + "px";
        canvas_draw.style.clientWidth = sw + "px";
        canvas_draw.style.clientHeight = sh + "px";
        canvas_draw.width = sw;
        canvas_draw.height = sh;
        w = vw * pscale;
        h = vh * pscale;
        pw = Math.max(w, h / 3 * 4);
        ph = Math.max(h, w / 4 * 3);
        ox = (pw - w) / 2;
        oy = (ph - h) / 2;
        canvas_process.style.clientWidth = pw + "px";
        canvas_process.style.clientHeight = ph + "px";
        canvas_process.width = pw;
        canvas_process.height = ph;

        renderer.setSize(sw, sh);

        worker = new Worker('../../js/artoolkit.worker.js');

        worker.postMessage({ type: "load", pw: pw, ph: ph, camera_para: camera_para, marker: '../' + marker.url });

        worker.onmessage = function(ev) {
            var msg = ev.data;
            switch (msg.type) {
                case "loaded": {
                    var proj = JSON.parse(msg.proj);
                    var ratioW = pw / w;
                    var ratioH = ph / h;
                    proj[0] *= ratioW;
                    proj[4] *= ratioW;
                    proj[8] *= ratioW;
                    proj[12] *= ratioW;
                    proj[1] *= ratioH;
                    proj[5] *= ratioH;
                    proj[9] *= ratioH;
                    proj[13] *= ratioH;
                    setMatrix(camera.projectionMatrix, proj);
                    break;
                }
                case "endLoading": {
                  if (msg.end == true)
                    // removing loader page if present
                    document.body.classList.remove("loading");
                    document.getElementById("loading").remove();
                  break;
                }
                case "found": {
                    found(msg);
                    break;
                }
                case "not found": {
                    found(null);
                    break;
                }
            }
            track_update();
            process();
        };
    };

    var world;

    var found = function(msg) {
      if (!msg) {
        world = null;
      } else {
        world = JSON.parse(msg.matrixGL_RH);
      }
    };

    var lasttime = Date.now();
    var time = 0;

    var draw = function() {
        render_update();
        var now = Date.now();
        var dt = now - lasttime;
        time += dt;
        lasttime = now;

        if (!world) {
            sphere.visible = false;
            var v = document.querySelector('#vid');
            v.pause();

        } else {
          sphere.visible = true;
          var el = document.querySelector("#video-data");
		  el.setAttribute("visible",true);
		  var v = document.querySelector('#vid');
          v.play();
          
          var video_data = document.getElementById( 'vid' );
          video_data.muted = false;

                // interpolate matrix
                for (var i = 0; i < 16; i++) {
                  trackedMatrix.delta[i] = world[i] - trackedMatrix.interpolated[i];
                  trackedMatrix.interpolated[i] =
                    trackedMatrix.interpolated[i] +
                    trackedMatrix.delta[i] / interpolationFactor;
                }
                spheretexture.needsUpdate = true;
                
                // set matrix of 'root' by detected 'world' matrix
                setMatrix(root.matrix, trackedMatrix.interpolated);
        }
        
        var aspect = window.innerWidth / window.innerHeight;
        var fov = 60 * ( Math.PI / 180 );
        
        var objectSize = 0.6 + ( 0.5 * Math.sin( Date.now() * 0.001 ) );
        sphere.scale.copy( new THREE.Vector3( objectSize, objectSize, objectSize ) );
        
        var cameraPosition = new THREE.Vector3(
            0,
            sphere.position.y + Math.abs( objectSize / Math.sin( fov / 2 ) ),
            0
        );
  
        camera.position.copy( cameraPosition );

        camera.lookAt( new THREE.Vector3( 0, 0, 0 ) );
                renderer.render(scene, camera);
            };

    function process() {
        context_process.fillStyle = "black";
        context_process.fillRect(0, 0, pw, ph);
        context_process.drawImage(video, 0, 0, vw, vh, ox, oy, w, h);
        spheretexture.needsUpdate = true;
		var imageData = context_process.getImageData(0, 0, pw, ph);
        worker.postMessage({ type: "process", imagedata: imageData }, [imageData.data.buffer]);
    }
    
    var tick = function() {
        draw();
        requestAnimationFrame(tick);
    };

    load();
    tick();
    process();
}