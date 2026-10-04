"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function woodTexture(w: number, h: number, hue = 22) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `hsl(${hue} 28% 18%)`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) {
    const y = (i / 80) * h;
    ctx.strokeStyle = `hsla(${hue + (i % 5)}, 35%, ${12 + (i % 9)}%, 0.55)`;
    ctx.lineWidth = 2 + Math.sin(i) * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 3);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function noiseTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 90 + Math.random() * 80;
    img.data[i] = n;
    img.data[i + 1] = n * 0.92;
    img.data[i + 2] = n * 0.78;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export default function CourtroomBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    mount.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a080c");
    scene.fog = new THREE.FogExp2("#0a080c", 0.018);

    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / mount.clientHeight,
      0.1,
      80
    );
    camera.position.set(1.35, 1.72, 7.15);

    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(x: T) => {
      disposables.push(x);
      return x;
    };

    const floorTex = track(woodTexture(1024, 1024, 24));
    floorTex.repeat.set(6, 10);
    const benchTex = track(woodTexture(512, 512, 18));
    const stoneTex = track(noiseTexture());

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 40),
      track(
        new THREE.MeshStandardMaterial({
          map: floorTex,
          roughness: 0.62,
          metalness: 0.04,
          color: "#c4a882",
        })
      )
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const runner = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 22),
      track(
        new THREE.MeshStandardMaterial({
          color: "#5c1824",
          roughness: 0.85,
          metalness: 0.05,
        })
      )
    );
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.01, -2);
    scene.add(runner);

    function addBox(
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      shadow = true
    ) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    }

    const plaster = track(
      new THREE.MeshStandardMaterial({ color: "#1c1714", roughness: 0.9, map: stoneTex })
    );
    const mahogany = track(
      new THREE.MeshStandardMaterial({
        map: benchTex,
        color: "#8a5a32",
        roughness: 0.5,
        metalness: 0.08,
      })
    );
    const darkWood = track(
      new THREE.MeshStandardMaterial({ color: "#3a2418", roughness: 0.48, metalness: 0.12 })
    );
    const gold = track(
      new THREE.MeshStandardMaterial({
        color: "#c9a227",
        emissive: "#5a3a10",
        emissiveIntensity: 0.35,
        metalness: 0.85,
        roughness: 0.28,
      })
    );
    const velvet = track(new THREE.MeshStandardMaterial({ color: "#4a1420", roughness: 0.92 }));

    addBox(28, 10, 0.4, 0, 5, -14, plaster);
    addBox(0.4, 10, 28, -10, 5, -2, plaster);
    addBox(0.4, 10, 28, 10, 5, -2, plaster);
    addBox(22, 0.35, 22, 0, 8.4, -4, darkWood, false);

    for (let i = 0; i < 3; i++) {
      const z = -12.2;
      const x = -5.2 + i * 5.2;
      const frame = addBox(2.6, 4.6, 0.2, x, 4.4, z, darkWood);
      frame.castShadow = false;
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 4.1),
        track(
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.08 + i * 0.02, 0.65, 0.42),
            emissive: new THREE.Color().setHSL(0.07 + i * 0.015, 0.8, 0.35),
            emissiveIntensity: 1.4,
            roughness: 0.2,
            transparent: true,
            opacity: 0.92,
          })
        )
      );
      pane.position.set(x, 4.4, z + 0.12);
      scene.add(pane);
    }

    for (const x of [-8.2, -4.1, 0, 4.1, 8.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 7.2, 16), mahogany);
      col.position.set(x, 3.6, -13.4);
      col.castShadow = true;
      scene.add(col);
      addBox(0.7, 0.18, 0.7, x, 7.25, -13.4, gold, false);
    }

    addBox(8.4, 1.5, 2.4, 0, 0.85, -11.2, mahogany);
    addBox(7.2, 0.16, 1.6, 0, 1.64, -11.1, gold, false);
    const benchSeat = addBox(2.2, 1.1, 1.8, 0, 2.3, -11.5, velvet);
    benchSeat.castShadow = true;

    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), gold);
    lampPole.position.set(1.35, 2.35, -10.4);
    scene.add(lampPole);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 0.28, 16, 1, true),
      track(
        new THREE.MeshStandardMaterial({
          color: "#e8c48a",
          emissive: "#ffb45a",
          emissiveIntensity: 1.6,
          side: THREE.DoubleSide,
        })
      )
    );
    shade.position.set(1.35, 2.95, -10.4);
    scene.add(shade);

    for (let row = 0; row < 5; row++) {
      const z = 1.2 + row * 1.35;
      for (const side of [-1, 1]) {
        addBox(3.6, 0.72, 0.9, side * 4.15, 0.42, z, mahogany);
        addBox(3.6, 0.55, 0.12, side * 4.15, 0.95, z + 0.38, darkWood);
      }
    }

    const docket = new THREE.Group();
    docket.position.set(-1.55, 1.08, 3.35);
    docket.rotation.y = 0.35;
    docket.rotation.x = -0.12;
    scene.add(docket);
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.04, 1.15),
      track(new THREE.MeshStandardMaterial({ color: "#6b1d1d", roughness: 0.7 }))
    );
    cover.castShadow = true;
    docket.add(cover);
    const pageL = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.01, 1.05),
      track(new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.8 }))
    );
    pageL.position.set(-0.22, 0.03, 0);
    docket.add(pageL);
    const pageR = pageL.clone();
    pageR.position.x = 0.22;
    docket.add(pageR);

    function makeGavel() {
      const g = new THREE.Group();
      g.name = "gavel";
      const woodMat = track(
        new THREE.MeshStandardMaterial({ color: "#6a3b16", roughness: 0.42, metalness: 0.06 })
      );
      const darkMat = track(
        new THREE.MeshStandardMaterial({ color: "#3a1f0d", roughness: 0.38, metalness: 0.08 })
      );
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 0.82, 14), woodMat);
      handle.position.y = 0.28;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.1, 12), gold);
      neck.position.y = 0.68;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 18), darkMat);
      head.rotation.z = Math.PI / 2;
      head.position.y = 0.74;
      const ring = (x: number) => {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.035, 18), gold);
        r.rotation.z = Math.PI / 2;
        r.position.set(x, 0.74, 0);
        return r;
      };
      g.add(handle, neck, head, ring(-0.13), ring(0.13));
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.userData.gavel = true;
        }
      });
      return g;
    }

    addBox(
      0.62,
      0.16,
      0.46,
      2.05,
      1.06,
      4.15,
      track(new THREE.MeshStandardMaterial({ color: "#2b1810", roughness: 0.55 }))
    );
    const gavel = makeGavel();
    gavel.position.set(2.05, 1.14, 4.15);
    gavel.rotation.set(0.15, -0.55, 0.35);
    gavel.scale.setScalar(1.15);
    scene.add(gavel);
    const gavelRest = gavel.rotation.clone();

    type PaperData = { spin: number; bob: number; baseY: number };
    const papers: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.38),
        track(
          new THREE.MeshStandardMaterial({
            color: i % 3 === 0 ? "#e7d7b1" : "#f3ead7",
            roughness: 0.85,
            side: THREE.DoubleSide,
          })
        )
      );
      p.position.set(
        (Math.random() - 0.5) * 7,
        1.4 + Math.random() * 3.2,
        -2 + Math.random() * 6
      );
      p.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
      p.userData = {
        spin: 0.12 + Math.random() * 0.25,
        bob: Math.random() * Math.PI * 2,
        baseY: p.position.y,
      } satisfies PaperData;
      scene.add(p);
      papers.push(p);
    }

    const dustGeo = track(new THREE.BufferGeometry()) as unknown as THREE.BufferGeometry;
    const dustCount = 420;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 16;
      dustPos[i * 3 + 1] = Math.random() * 7;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      track(
        new THREE.PointsMaterial({
          color: "#e8c9a0",
          size: 0.018,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
      )
    );
    scene.add(dust);

    scene.add(new THREE.AmbientLight("#3a2a22", 0.35));
    const key = new THREE.SpotLight("#ffd2a8", 32, 32, 0.7, 0.4, 1.1);
    key.position.set(-2.2, 7.4, 4.8);
    key.target.position.set(0, 1.2, -2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key, key.target);

    const windowLight = new THREE.PointLight("#ff9955", 38, 24, 1.2);
    windowLight.position.set(0, 4.6, -12);
    scene.add(windowLight);

    const lamp = new THREE.PointLight("#ffc27a", 6, 7, 2);
    lamp.position.set(1.35, 2.85, -10.2);
    scene.add(lamp);

    const rim = new THREE.DirectionalLight("#6a7cff", 0.35);
    rim.position.set(4, 3, 6);
    scene.add(rim);

    const gavelGlow = new THREE.PointLight("#ffc56a", 0.15, 4, 2);
    gavelGlow.position.copy(gavel.position);
    gavelGlow.position.y += 0.3;
    scene.add(gavelGlow);

    function onPointerMove(e: PointerEvent) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(gavel, true);
      gavelGlow.intensity = hits.length ? 2.4 : 0.15;
    }
    window.addEventListener("pointermove", onPointerMove);

    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    let raf = 0;
    function tick() {
      const t = clock.elapsedTime;

      camera.position.x = 1.35 + mouse.x * 0.45;
      camera.position.y = 1.72 + mouse.y * 0.14;
      camera.lookAt(-0.4, 1.55, -3.4);

      windowLight.intensity = 20 + Math.sin(t * 0.7) * 2.2;
      shade.material.emissiveIntensity = 1.4 + Math.sin(t * 1.8) * 0.25;

      papers.forEach((p, i) => {
        p.rotation.y += p.userData.spin * 0.01;
        p.rotation.z += 0.004;
        p.position.y = p.userData.baseY + Math.sin(t * 0.6 + p.userData.bob) * 0.18;
        p.position.x += Math.sin(t * 0.15 + i) * 0.0015;
      });

      dust.rotation.y = t * 0.012;
      docket.rotation.z = Math.sin(t * 0.4) * 0.015;

      gavel.rotation.z = gavelRest.z + Math.sin(t * 1.1) * 0.04;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    clock.start();
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose();
        }
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      mount.removeChild(canvas);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
