import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FUR_CLEAN, FUR_DIRTY, FUR_SICK, FUR_WET, GEO, M, mat } from './materials';
import { petRuntime } from './petRuntime';
import { useGameStore } from '../store/useGameStore';
import { wetness } from '../game/pet';
import { viewRuntime, wrapAngle } from './viewRuntime';
import { BALANCE } from '../data/balance';
import type { Activity } from '../game/types';
import { FETCH, fetchTimeline, type FetchTimeline } from '../game/fetch';
import { CAPTURE, captureTimeline, type CaptureTimeline } from '../game/capture';

const { damp } = THREE.MathUtils;
const TAU = Math.PI * 2;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (p: number, a: number, b: number) => ease((p - a) / (b - a));
/** 彈出效果：超過一點再回來 */
const easeOutBack = (x: number) => {
  const c = 1.9;
  const q = Math.min(1, Math.max(0, x)) - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
};
const CAPTURE_RED = new THREE.Color('#ff3b3b');
const FUR_EMISSIVE = new THREE.Color('#fff4e0');

/** 一團毛（低多邊形二十面體） */
function Fluff({ p, s, m = M.fur, low = false }: { p: [number, number, number]; s: number | [number, number, number]; m?: THREE.Material; low?: boolean }) {
  return <mesh geometry={low ? GEO.fluffLow : GEO.fluff} material={m} position={p} scale={s} castShadow />;
}

/**
 * 程式組合的白色狐狸犬。
 * 結構：root（地板位置/朝向）→ body（跳躍/翻滾）→ head / tail / legs 各自有樞紐可旋轉。
 */
export function Pet() {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Group>(null!);
  const earL = useRef<THREE.Group>(null!);
  const earR = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Group>(null!);
  const eyeR = useRef<THREE.Group>(null!);
  const mouth = useRef<THREE.Mesh>(null!);
  const tongue = useRef<THREE.Mesh>(null!);
  const legs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const ball = useRef<THREE.Mesh>(null!);
  const bowl = useRef<THREE.Group>(null!);
  const pill = useRef<THREE.Group>(null!);
  const marker = useRef<THREE.Mesh>(null!);
  const bowlPivot = useRef<THREE.Group>(null!);

  // 動畫狀態（平滑插值用）
  const anim = useRef({
    actKey: '',
    actStart: 0,
    tl: null as FetchTimeline | null,
    capTl: null as CaptureTimeline | null,
    emissive: new THREE.Color(),
    nextBlink: 1,
    blinkUntil: 0,
    tiltTarget: 0,
    nextTilt: 2,
    nextHop: 4,
    hopStart: -10,
    nextScratch: 3,
    scratchStart: -10,
    nextYawn: 3,
    yawnStart: -10,
    lieAmt: 0,
    /** 玩家旋轉視角的套用比例：丟球跑來跑去時暫時為 0 */
    yawWeight: 1,
    nextWetShake: 0,
    wetShakeStart: -10,
    faceY: 0,
    furColor: new THREE.Color(),
  });

  const ballMat = useMemo(() => mat('#ff8a65'), []);
  const ballStripe = useMemo(() => mat('#ffe082'), []);
  const bowlMat = useMemo(() => mat('#7fb3e0'), []);
  const foodMat = useMemo(() => mat('#c98b52'), []);
  const pillA = useMemo(() => mat('#ff8fa3'), []);
  const markerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ff8a65', transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  );
  const pillB = useMemo(() => mat('#ffffff'), []);


  // 觸控判定由 GestureController 統一處理，這裡只登記可被點到的部位
  useEffect(() => {
    petRuntime.hitTargets = [torso.current, head.current];
  }, []);

  // ---------- 每幀動畫 ----------
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const s = useGameStore.getState().pet;
    const { stats } = s;

    // 偵測新動作開始
    const key = `${s.activity}:${s.activityStartedAt}`;
    if (key !== a.actKey) {
      a.actKey = key;
      a.actStart = t;
      a.tl = s.activity === 'playing' && s.ballTarget ? fetchTimeline(s.ballTarget) : null;
      a.capTl = s.activity === 'captured' && s.capture ? captureTimeline(s.capture.escapeAfter) : null;
    }
    const act: Activity = s.activityLeft > 0 ? s.activity : 'idle';
    const at = t - a.actStart; // 動作已進行秒數

    const happy = stats.happiness;
    const lying = s.sleeping || s.sick;
    const tired = stats.energy <= 0;
    const dirty = stats.cleanliness <= 15;
    const hungry = stats.hunger <= 0;

    // 目標值
    let posX = 0, posZ = 0, faceY = 0;
    let bodyY = 0, bodyRotZ = 0, bodyRotX = 0;
    let headX = 0, headY = 0, headZ = a.tiltTarget;
    let earX = 0;
    let eyeOpen = 1;
    let mouthOpen = 0;
    let tongueOut = happy > 60 ? 1 : 0;
    let wagSpeed = 4 + (happy / 100) * 14;
    let wagAmp = 0.15 + (happy / 100) * 0.4;
    let legSwing = 0;
    let scratchLeg = 0;
    let lie = lying ? 1 : 0;
    let bodyRotY = 0;
    let headPY = 0, headPZ = 0; // 頭的位移（吃飯時往前伸）
    let earFlutter = 0;
    let shake = 0; // 甩身體強度 0~1
    let spinY: number | null = null; // 直接指定身體的水平旋轉（轉圈用）
    let squash = 0; // 落地壓扁 0~1
    let legTuck = 0; // 空中縮腳 0~1
    let bow = 0; // 伸懶腰姿勢 0~1
    let fast = false; // 身體高度要快速跟上（跳躍用）
    let petScale = 1; // 被吸進寶可夢球時縮小
    let capLift = 0; // 被吸進球時往上飄
    let capTint = 0; // 紅光 0~1

    // --- 眨眼 ---
    if (t > a.nextBlink) {
      a.blinkUntil = t + 0.12;
      a.nextBlink = t + 2 + Math.random() * 3;
    }
    if (t < a.blinkUntil) eyeOpen = 0.1;

    // --- 隨機歪頭 ---
    if (t > a.nextTilt) {
      a.tiltTarget = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1) * 0.3;
      a.nextTilt = t + 2 + Math.random() * 3;
    }

    // --- 狀態姿勢 ---
    if (s.sleeping) {
      eyeOpen = 0.05;
      headX = 0.35;
      headZ = 0.25;
      headY = 0.2;
      wagSpeed = 0;
      tongueOut = 0;
      earX = 0.3;
      bodyY = Math.sin(t * 1.5) * 0.01;
    } else if (s.sick) {
      eyeOpen = 0.35;
      headX = 0.3;
      headZ = 0;
      wagSpeed = 0;
      tongueOut = 0;
      earX = 0.6;
      bodyRotZ = Math.sin(t * 40) * 0.01; // 發抖
    } else if (s.sulking) {
      faceY = Math.PI * 0.85; // 背對你
      wagSpeed = 0;
      tongueOut = 0;
      earX = 0.5;
      headX = -0.15;
      eyeOpen = Math.min(eyeOpen, 0.5);
    } else {
      if (happy < BALANCE.lowThreshold) {
        earX = 0.4;
        wagSpeed = 2;
        wagAmp = 0.08;
        tongueOut = 0;
        headX = 0.15;
      }
      if (tired) {
        eyeOpen = Math.min(eyeOpen, 0.4);
        bodyRotZ = Math.sin(t * 1.2) * 0.04;
        if (t > a.nextYawn) {
          a.yawnStart = t;
          a.nextYawn = t + 4 + Math.random() * 2;
        }
        const y = t - a.yawnStart;
        if (y < 1.2) {
          mouthOpen = Math.sin((y / 1.2) * Math.PI);
          headX = -0.35 * mouthOpen;
          eyeOpen = 0.1;
        }
      }
      if (hungry) {
        headX = 0.35 + Math.sin(t * 2) * 0.05; // 看著地板
        tongueOut = 0;
      }
      if (dirty && act === 'idle') {
        if (t > a.nextScratch) {
          a.scratchStart = t;
          a.nextScratch = t + 3 + Math.random() * 3;
        }
        const sc = t - a.scratchStart;
        if (sc < 1.0) {
          scratchLeg = 1;
          headZ = 0.35;
          bodyRotZ = -0.12;
        }
      }
      // 開心時偶爾跳一下
      if (happy > 70 && act === 'idle' && !tired && !hungry) {
        if (t > a.nextHop) {
          a.hopStart = t;
          a.nextHop = t + 3 + Math.random() * 4;
        }
        const h = t - a.hopStart;
        if (h < 0.45) bodyY = Math.sin((h / 0.45) * Math.PI) * 0.22;
      }
    }

    // --- 洗澡 ---
    const wetTarget = wetness(s);
    petRuntime.wet = damp(petRuntime.wet, wetTarget, 4, dt);
    const touching = s.bathing && petRuntime.bath.touching;
    if (s.bathing) {
      tongueOut = 0;
      if (touching && s.bathStage === 'wash') {
        eyeOpen = 0.25; // 搓泡泡很舒服
        tongueOut = 1;
        wagSpeed = 16;
      } else if (touching) {
        eyeOpen = 0.4; // 被吹風吹得瞇眼
        earFlutter = 1;
        wagSpeed = 10;
      } else {
        earX = 0.35; // 濕答答
        wagSpeed = 2;
        wagAmp = 0.1;
      }
      // 好一陣子沒碰牠：自己甩身體噴水
      if (!touching && petRuntime.wet > 0.25 && t - petRuntime.bath.lastTouch > 3 && t > a.nextWetShake) {
        a.wetShakeStart = t;
        a.nextWetShake = t + 4 + Math.random() * 2;
      }
      const ws = t - a.wetShakeStart;
      if (ws < 0.9) shake = 1 - ws / 0.9;
    }

    // --- 動作 ---
    let ballVisible = false;
    let bowlVisible = 0;
    let pillVisible = false;

    switch (act) {
      case 'eating': {
        bowlVisible = 1;
        // 身體前傾、頭往前下方伸出，嘴巴靠近碗（不會埋進胸毛）
        const reach = ease(Math.min(1, at / 0.3));
        bodyRotX = 0.12 * reach;
        headPY = -0.34 * reach;
        headPZ = 0.26 * reach;
        headX = (0.5 + Math.abs(Math.sin(at * 9)) * 0.12) * reach;
        headZ = 0;
        mouthOpen = Math.abs(Math.sin(at * 9)) * 0.7;
        wagSpeed = 16;
        wagAmp = 0.5;
        eyeOpen = 0.5;
        break;
      }
      case 'petHead': {
        eyeOpen = 0.2;
        headZ = Math.sin(at * 6) * 0.25;
        headX = -0.1;
        tongueOut = 1;
        wagSpeed = 20;
        wagAmp = 0.6;
        bodyY = Math.max(0, Math.sin(at * 5)) * 0.1;
        break;
      }
      case 'jump':
      case 'jumpSpin': {
        // 蹲低蓄力 → 起跳（耳朵往後飛、縮腳）→ 落地壓扁再彈回
        const spin = act === 'jumpSpin';
        const dur = BALANCE.pet.durations[act];
        const crouchEnd = spin ? 0.3 : 0.22;
        const landAt = dur - (spin ? 0.3 : 0.25);
        const height = spin ? 0.7 : 0.48;
        fast = true;
        if (at < crouchEnd) {
          const q = at / crouchEnd;
          bodyY = -0.1 * Math.sin(q * Math.PI * 0.5);
          squash = 0.6 * q;
        } else if (at < landAt) {
          const q = (at - crouchEnd) / (landAt - crouchEnd);
          bodyY = Math.sin(q * Math.PI) * height;
          legTuck = Math.sin(q * Math.PI);
          earX = -0.6 * Math.sin(q * Math.PI);
          if (spin) spinY = ease(q) * TAU;
        } else {
          const q = (at - landAt) / (dur - landAt);
          squash = Math.sin(q * Math.PI) * (1 - q * 0.3);
          bodyY = -0.06 * Math.sin(q * Math.PI);
        }
        eyeOpen = 0.25;
        tongueOut = 1;
        wagSpeed = 22;
        wagAmp = 0.6;
        break;
      }
      case 'nuzzle': {
        // 頭左右磨蹭你的手
        const q = Math.min(1, at / BALANCE.pet.durations.nuzzle);
        const fade = Math.sin(q * Math.PI);
        headZ = Math.sin(at * 9) * 0.32 * fade;
        headY = Math.sin(at * 9 + 0.6) * 0.25 * fade;
        headX = -0.15 * fade;
        bodyRotZ = Math.sin(at * 9) * 0.05 * fade;
        eyeOpen = 0.12;
        tongueOut = 1;
        wagSpeed = 20;
        wagAmp = 0.55;
        break;
      }
      case 'chaseTail': {
        // 原地追尾巴轉 2 圈，最後暈暈的晃一下
        const turnEnd = 1.35;
        if (at < turnEnd) {
          const q = at / turnEnd;
          spinY = -ease(q) * TAU * 2;
          headY = -0.6; // 頭轉向尾巴
          headX = 0.15;
          legSwing = 1;
          wagSpeed = 26;
          wagAmp = 0.7;
        } else {
          const q = (at - turnEnd) / (BALANCE.pet.durations.chaseTail - turnEnd);
          bodyRotZ = Math.sin(q * Math.PI * 3) * 0.12 * (1 - q);
          headZ = Math.sin(q * Math.PI * 3 + 1) * 0.3 * (1 - q);
          eyeOpen = 0.3;
        }
        tongueOut = 1;
        break;
      }
      case 'playBow': {
        // 伸懶腰：前腳往前伸、屁股翹高、尾巴猛搖
        const dur = BALANCE.pet.durations.playBow;
        bow = at < 0.3 ? ease(at / 0.3) : at > dur - 0.35 ? ease((dur - at) / 0.35) : 1;
        bodyRotZ = Math.sin(at * 14) * 0.05 * bow; // 屁股扭扭
        headX = -0.45 * bow; // 抬頭看你
        eyeOpen = 0.9;
        tongueOut = 1;
        wagSpeed = 28;
        wagAmp = 0.75;
        break;
      }
      case 'captureMiss': {
        // 球丟偏了：轉頭看球
        headX = -0.1;
        headY = 0.4;
        break;
      }
      case 'captured': {
        const tl = a.capTl;
        if (!tl) break;
        faceY = 0;
        lie = 0;
        wagSpeed = 0;
        tongueOut = 0;
        if (at < tl.hitAt) {
          headX = -0.35; // 看著飛過來的球
          eyeOpen = 1;
        } else if (tl.breakAt === null ? at < tl.releaseAt! : at < tl.breakAt) {
          // 被紅光吸進球裡
          const k = seg(at, tl.hitAt + 0.12, tl.inBallAt - 0.15);
          petScale = 1 - k;
          capLift = k * 0.9;
          capTint = Math.min(1, (at - tl.hitAt) / 0.15);
          eyeOpen = 0.2;
        } else if (tl.releaseAt !== null) {
          // 收服成功 3 秒後：在煙霧中出現，開心跳一下
          const q = (at - tl.releaseAt) / CAPTURE.release;
          petScale = q < 0.1 ? 0 : easeOutBack((q - 0.1) / 0.45);
          capTint = 1 - seg(q, 0.1, 0.6);
          if (q > 0.55) bodyY = Math.sin(((q - 0.55) / 0.45) * Math.PI) * 0.3;
          fast = true;
          tongueOut = 1;
          eyeOpen = q > 0.55 ? 0.25 : 1;
          wagSpeed = 22;
          wagAmp = 0.6;
        } else {
          // 掙脫：跳出來，甩甩頭
          const q = (at - tl.breakAt!) / CAPTURE.escape;
          petScale = easeOutBack(q / 0.3);
          capTint = 1 - seg(q, 0, 0.4);
          if (q > 0.35 && q < 0.8) headY = Math.sin(at * 28) * 0.4;
          earX = 0.2;
          eyeOpen = 0.6;
        }
        break;
      }
      case 'shake': {
        // 洗完甩一甩，毛變蓬鬆
        shake = 1 - at / BALANCE.bath.shakeDuration;
        eyeOpen = 0.2;
        tongueOut = 1;
        break;
      }
      case 'refuse': {
        headY = Math.sin(at * 25) * 0.4;
        break;
      }
      case 'medicine': {
        const p = at / BALANCE.medicine.duration;
        pillVisible = p < 0.35;
        if (p > 0.35 && p < 0.7) {
          headY = Math.sin(at * 30) * 0.35; // 苦得搖頭
          eyeOpen = 0.1;
        }
        if (p >= 0.7) bodyY = Math.sin(((p - 0.7) / 0.3) * Math.PI) * 0.3;
        lie = 0;
        break;
      }
      case 'playing': {
        const tl = a.tl;
        if (!tl) break;
        const T = tl.target;
        const B = ball.current.position;
        const R = 0.12; // 球半徑
        const dirOut = Math.atan2(tl.stop.x, tl.stop.z);
        const dirBack = Math.atan2(-tl.stop.x, -tl.stop.z);
        const grabAt = tl.arrive + FETCH.grab * 0.5;
        ballVisible = true;

        // 寵物位置與朝向
        if (at < tl.runStart) {
          faceY = dirOut;
          headX = -0.35; // 抬頭看球飛
          bodyY = Math.max(0, Math.sin(at * 12)) * 0.08;
        } else if (at < tl.arrive) {
          const q = (at - tl.runStart) / (tl.arrive - tl.runStart);
          posX = tl.stop.x * q;
          posZ = tl.stop.z * q;
          faceY = dirOut;
          legSwing = 1;
        } else if (at < tl.returnStart) {
          posX = tl.stop.x;
          posZ = tl.stop.z;
          faceY = at < tl.grabEnd ? dirOut : dirBack;
          if (at < tl.grabEnd) headX = 0.6; // 低頭叼球
        } else if (at < tl.home) {
          const q = (at - tl.returnStart) / (tl.home - tl.returnStart);
          posX = tl.stop.x * (1 - q);
          posZ = tl.stop.z * (1 - q);
          faceY = dirBack;
          legSwing = 1;
        } else {
          // 回到原位：轉向你、開心跳
          const q = seg(at, tl.home, tl.total);
          faceY = 0;
          bodyY = Math.abs(Math.sin(q * Math.PI * 2)) * 0.25;
          tongueOut = 1;
          eyeOpen = 0.25;
        }

        // 球的位置
        if (at < tl.land) {
          const q = at / tl.land;
          const dist = Math.hypot(T.x - FETCH.origin.x, T.z - FETCH.origin.z);
          B.set(
            THREE.MathUtils.lerp(FETCH.origin.x, T.x, q),
            THREE.MathUtils.lerp(FETCH.origin.y, R, q) + Math.sin(q * Math.PI) * (0.5 + dist * 0.22),
            THREE.MathUtils.lerp(FETCH.origin.z, T.z, q),
          );
          ball.current.rotation.x -= dt * 12;
        } else if (at < grabAt) {
          // 落地彈跳
          const k = at - tl.land;
          B.set(T.x, R + Math.abs(Math.sin(k * 9)) * 0.3 * Math.exp(-k * 3.5), T.z);
        } else if (at < tl.home + 0.35) {
          B.copy(petRuntime.mouth); // 叼在嘴裡
        } else {
          // 放下球，滾到你面前
          const k = at - (tl.home + 0.35);
          B.set(petRuntime.position.x, R + Math.abs(Math.sin(k * 8)) * 0.15 * Math.exp(-k * 4), petRuntime.position.z + 0.55 + k * 0.4);
        }

        // 落點標記
        marker.current.visible = at < tl.land + 0.5;
        marker.current.position.set(T.x, 0.03, T.z);
        const ms = 0.25 + (at < tl.land ? 0.15 * (1 - at / tl.land) : 0) + Math.sin(t * 10) * 0.02;
        marker.current.scale.setScalar(ms);

        wagSpeed = 22;
        wagAmp = 0.6;
        lie = 0;
        break;
      }
    }
    if (act !== 'playing') marker.current.visible = false;

    // ---------- 套用 ----------
    const r = root.current;
    r.position.x = act === 'playing' ? posX : damp(r.position.x, posX, 6, dt);
    r.position.z = act === 'playing' ? posZ : damp(r.position.z, posZ, 6, dt);
    // 轉向取最短路徑
    let df = faceY - a.faceY;
    df = (((df + Math.PI) % TAU) + TAU) % TAU - Math.PI;
    a.faceY += df * Math.min(1, dt * (act === 'playing' ? 10 : 6));
    // 玩家滑動螢幕：寵物原地旋轉（追球時暫停套用，回來後再轉回玩家設定的角度）
    a.yawWeight = damp(a.yawWeight, act === 'playing' ? 0 : 1, 5, dt);
    const yawEff = wrapAngle(viewRuntime.yaw) * a.yawWeight;
    r.rotation.y = a.faceY + yawEff;
    // 寶可夢球：縮小、往上飄、整隻消失
    r.scale.setScalar(Math.max(0.0001, petScale));
    r.position.y = capLift;
    r.visible = petScale > 0.01;
    bowlPivot.current.rotation.y = yawEff;
    petRuntime.rootYaw = r.rotation.y;
    petRuntime.position.copy(r.position);

    a.lieAmt = damp(a.lieAmt, lie, 5, dt);
    const L = a.lieAmt;

    const b = body.current;
    const runBob = legSwing ? Math.abs(Math.sin(t * 18)) * 0.08 : 0;
    // 伸懶腰：身體前傾（前低後高），整體稍微抬高避免前胸碰到地板
    bodyRotX += 0.4 * bow;
    bodyY += 0.08 * bow;
    b.position.y = damp(b.position.y, bodyY + runBob - L * 0.2, fast || bodyY > 0 ? 30 : 10, dt);
    b.rotation.z = damp(b.rotation.z, bodyRotZ, 10, dt);
    b.rotation.x = damp(b.rotation.x, bodyRotX, bow > 0 ? 14 : 8, dt);
    if (shake > 0) bodyRotY = Math.sin(t * 38) * 0.45 * shake;
    if (spinY !== null) {
      b.rotation.y = spinY;
    } else {
      // 轉完圈後角度可能是 2π 的倍數，先換算回 -π~π 才不會倒轉回去
      b.rotation.y = damp(wrapAngle(b.rotation.y), bodyRotY, 30, dt);
    }
    petRuntime.shaking = shake > 0.1;

    // 呼吸
    const breath = 1 + Math.sin(t * (s.sleeping ? 1.6 : 3)) * (s.sleeping ? 0.035 : 0.02);
    // 濕毛會貼身變小一圈；甩乾後恢復蓬鬆
    const W = petRuntime.wet;
    const puff = act === 'shake' ? 1 + Math.sin(Math.min(1, at / BALANCE.bath.shakeDuration) * Math.PI) * 0.08 : 1;
    const wetBody = (1 - 0.16 * W) * puff;
    const sq = 1 - 0.18 * squash; // 落地壓扁：變矮變寬
    const sw = 1 + 0.1 * squash;
    torso.current.scale.set(breath * wetBody * sw, breath * (1 - 0.1 * W) * puff * sq, wetBody * sw);
    tail.current.scale.setScalar((1 - 0.35 * W) * puff);
    head.current.scale.setScalar((1 - 0.07 * W) * puff);

    const h = head.current;
    h.rotation.x = damp(h.rotation.x, headX + L * 0.15, 8, dt);
    h.rotation.y = damp(h.rotation.y, headY - bodyRotY * 0.6, act === 'refuse' || act === 'medicine' || shake > 0 ? 30 : 8, dt);
    h.rotation.z = damp(h.rotation.z, headZ, 6, dt);
    h.position.y = damp(h.position.y, 0.98 - L * 0.14 + headPY, 10, dt);
    h.position.z = damp(h.position.z, 0.32 + L * 0.08 + headPZ, 10, dt);

    // 尾巴：左右搖
    tail.current.rotation.z = Math.sin(t * wagSpeed) * wagAmp;
    tail.current.rotation.x = damp(tail.current.rotation.x, happy < BALANCE.lowThreshold || s.sulking ? 0.4 : 0, 4, dt);

    // 耳朵
    earL.current.rotation.x = damp(earL.current.rotation.x, earX, 6, dt);
    earR.current.rotation.x = damp(earR.current.rotation.x, earX, 6, dt);
    const flut = earFlutter ? Math.sin(t * 45) * 0.18 : 0;
    earL.current.rotation.z = -0.22 + Math.sin(t * 3) * 0.03 + flut;
    earR.current.rotation.z = 0.22 - Math.sin(t * 3 + 1) * 0.03 - flut;

    // 眼睛
    const ey = damp(eyeL.current.scale.y, eyeOpen, 25, dt);
    eyeL.current.scale.y = ey;
    eyeR.current.scale.y = ey;

    // 嘴巴與舌頭
    mouth.current.scale.y = damp(mouth.current.scale.y, 0.02 + mouthOpen * 0.06, 15, dt);
    const ts = damp(tongue.current.scale.x, tongueOut ? 0.055 : 0.0001, 10, dt);
    tongue.current.scale.set(ts, ts * 0.5, ts * 1.2);
    tongue.current.position.y = -0.17 - Math.sin(t * 8) * 0.008 * tongueOut;

    // 腿：跑步擺動、趴下收腿、抓癢
    legs.forEach((lg, i) => {
      const front = i < 2;
      const side = i % 2 === 0 ? 1 : -1;
      let rx = legSwing ? Math.sin(t * 18 + (front ? 0 : Math.PI) + (side > 0 ? 0 : Math.PI / 2)) * 0.8 : 0;
      if (scratchLeg && i === 2) rx = -0.9 + Math.sin(t * 40) * 0.4;
      rx += L * (front ? -1.3 : 1.3);
      // 空中縮腳：前腳往後收、後腳往前收
      rx += legTuck * (front ? 0.8 : -0.8);
      // 伸懶腰：前腳往前伸直貼地，後腳抵銷身體前傾保持直立
      rx += bow * (front ? -1.2 : -0.4);
      lg.current.rotation.x = damp(lg.current.rotation.x, rx, 20, dt);
    });

    // 毛色：髒 → 偏米褐色；生病 → 偏黃綠
    const dirtyAmt = Math.max(0, (50 - stats.cleanliness) / 50);
    a.furColor.copy(FUR_CLEAN).lerp(FUR_DIRTY, dirtyAmt * 0.7);
    if (s.sick) a.furColor.lerp(FUR_SICK, 0.6);
    a.furColor.lerp(FUR_WET, W * 0.55);
    (M.fur as THREE.MeshStandardMaterial).color.lerp(a.furColor, Math.min(1, dt * 3));
    // 濕的毛有光澤
    (M.fur as THREE.MeshStandardMaterial).roughness = 0.85 - 0.5 * W;
    (M.furShade as THREE.MeshStandardMaterial).roughness = 0.85 - 0.5 * W;
    // 被收服時的紅光
    a.emissive.copy(FUR_EMISSIVE).lerp(CAPTURE_RED, capTint);
    for (const m of [M.fur, M.furShade] as THREE.MeshStandardMaterial[]) {
      m.emissive.copy(a.emissive);
    }
    (M.fur as THREE.MeshStandardMaterial).emissiveIntensity = 0.18 + capTint * 0.9;
    (M.furShade as THREE.MeshStandardMaterial).emissiveIntensity = 0.12 + capTint * 0.9;

    // 共享座標給特效
    h.updateWorldMatrix(true, false);
    petRuntime.mouth.set(0, -0.14, 0.5).applyMatrix4(h.matrixWorld);
    petRuntime.headTop.set(0, 0.45, 0).applyMatrix4(h.matrixWorld);

    // 道具
    ball.current.visible = ballVisible;
    bowl.current.visible = bowlVisible > 0;
    pill.current.visible = pillVisible;
    if (pillVisible) {
      const q = Math.min(1, at / (BALANCE.medicine.duration * 0.35));
      pill.current.position.set(
        THREE.MathUtils.lerp(0, petRuntime.mouth.x, q),
        THREE.MathUtils.lerp(1.8, petRuntime.mouth.y, q),
        THREE.MathUtils.lerp(1.5, petRuntime.mouth.z, q),
      );
      pill.current.rotation.z = t * 6;
    }
  });

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          {/* 身體：一大團蓬鬆的毛 */}
          <group ref={torso} position={[0, 0.5, 0]} userData={{ part: 'body' }}>
            <Fluff p={[0, 0, 0]} s={[0.5, 0.42, 0.58]} />
            <Fluff p={[0, 0.08, 0.28]} s={[0.42, 0.42, 0.36]} />
            {/* 胸前鬃毛 */}
            <Fluff p={[0, 0.2, 0.42]} s={0.3} />
            <Fluff p={[0.2, 0.16, 0.36]} s={0.24} />
            <Fluff p={[-0.2, 0.16, 0.36]} s={0.24} />
            <Fluff p={[0, -0.04, 0.46]} s={0.22} m={M.furShade} />
            {/* 臀部 */}
            <Fluff p={[0.18, -0.02, -0.34]} s={0.28} />
            <Fluff p={[-0.18, -0.02, -0.34]} s={0.28} />
          </group>

          {/* 四條小短腿 */}
          {[
            [0.2, 0.3],
            [-0.2, 0.3],
            [0.2, -0.32],
            [-0.2, -0.32],
          ].map(([x, z], i) => (
            <group key={i} ref={legs[i]} position={[x, 0.28, z]}>
              <mesh geometry={GEO.leg} material={M.fur} position={[0, -0.12, 0]} scale={[0.09, 0.24, 0.09]} castShadow />
              <mesh geometry={GEO.fluffLow} material={M.fur} position={[0, -0.24, 0.03]} scale={[0.1, 0.06, 0.12]} castShadow />
            </group>
          ))}

          {/* 尾巴：捲在背上的大蓬毛 */}
          <group ref={tail} position={[0, 0.72, -0.42]}>
            <Fluff p={[0, 0.12, -0.04]} s={0.2} />
            <Fluff p={[0, 0.28, 0.02]} s={0.26} />
            <Fluff p={[0, 0.36, 0.2]} s={0.24} />
            <Fluff p={[0.05, 0.3, 0.34]} s={0.18} m={M.furShade} />
          </group>

          {/* 頭 */}
          <group ref={head} position={[0, 0.98, 0.32]} userData={{ part: 'head' }}>
            <Fluff p={[0, 0, 0]} s={[0.4, 0.37, 0.36]} />
            {/* 臉頰的毛 */}
            <Fluff p={[0.27, -0.12, 0.04]} s={0.21} />
            <Fluff p={[-0.27, -0.12, 0.04]} s={0.21} />
            <Fluff p={[0, 0.16, -0.12]} s={0.26} />
            {/* 獅子般的頸部鬃毛 */}
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <Fluff key={i} p={[Math.cos(a) * 0.36, Math.sin(a) * 0.3 - 0.06, -0.12]} s={0.2} m={i % 2 ? M.furShade : M.fur} />;
            })}
            {/* 嘴吻 */}
            <Fluff p={[0, -0.11, 0.3]} s={[0.15, 0.11, 0.14]} m={M.cream} />
            <mesh geometry={GEO.ball} material={M.black} position={[0, -0.06, 0.43]} scale={[0.05, 0.038, 0.038]} />
            <mesh ref={mouth} geometry={GEO.ball} material={M.tongue} position={[0, -0.17, 0.37]} scale={[0.05, 0.02, 0.02]} />
            <mesh ref={tongue} geometry={GEO.ball} material={M.tongue} position={[0, -0.18, 0.39]} scale={0.0001} />
            {/* 眼睛 */}
            <group ref={eyeL} position={[0.14, 0.04, 0.31]}>
              <mesh geometry={GEO.ball} material={M.black} scale={[0.062, 0.072, 0.035]} />
              <mesh geometry={GEO.ball} material={M.shine} position={[0.02, 0.028, 0.03]} scale={0.018} />
            </group>
            <group ref={eyeR} position={[-0.14, 0.04, 0.31]}>
              <mesh geometry={GEO.ball} material={M.black} scale={[0.062, 0.072, 0.035]} />
              <mesh geometry={GEO.ball} material={M.shine} position={[0.02, 0.028, 0.03]} scale={0.018} />
            </group>
            {/* 腮紅 */}
            <mesh geometry={GEO.ball} material={M.blush} position={[0.24, -0.08, 0.26]} scale={[0.05, 0.03, 0.02]} />
            <mesh geometry={GEO.ball} material={M.blush} position={[-0.24, -0.08, 0.26]} scale={[0.05, 0.03, 0.02]} />
            {/* 尖耳朵 */}
            <group ref={earL} position={[0.19, 0.3, -0.04]}>
              <mesh geometry={GEO.cone} material={M.fur} position={[0, 0.12, 0]} scale={[0.12, 0.26, 0.08]} castShadow />
              <mesh geometry={GEO.cone} material={M.pink} position={[0, 0.11, 0.035]} scale={[0.07, 0.18, 0.04]} />
            </group>
            <group ref={earR} position={[-0.19, 0.3, -0.04]}>
              <mesh geometry={GEO.cone} material={M.fur} position={[0, 0.12, 0]} scale={[0.12, 0.26, 0.08]} castShadow />
              <mesh geometry={GEO.cone} material={M.pink} position={[0, 0.11, 0.035]} scale={[0.07, 0.18, 0.04]} />
            </group>
          </group>
        </group>
      </group>

      {/* 球 */}
      <mesh ref={ball} geometry={GEO.ball} material={ballMat} scale={0.12} visible={false} castShadow>
        <mesh geometry={GEO.ball} material={ballStripe} scale={[1.02, 0.25, 1.02]} />
      </mesh>

      {/* 球的落點標記 */}
      <mesh ref={marker} material={markerMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.7, 1, 20]} />
      </mesh>

      {/* 飯碗：跟著寵物的旋轉一起轉，永遠在嘴巴前面 */}
      <group ref={bowlPivot}>
      <group ref={bowl} position={[0, 0, 0.92]} visible={false}>
        <mesh material={bowlMat} position={[0, 0.07, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.16, 0.14, 10]} />
        </mesh>
        {[[0, 0.15, 0], [0.07, 0.15, 0.04], [-0.06, 0.15, -0.03], [0.02, 0.17, -0.06], [-0.05, 0.16, 0.06]].map((p, i) => (
          <mesh key={i} geometry={GEO.fluffLow} material={foodMat} position={p as [number, number, number]} scale={0.05} />
        ))}
      </group>

      </group>

      {/* 藥丸 */}
      <group ref={pill} visible={false}>
        <mesh geometry={GEO.ball} material={pillA} position={[0.04, 0, 0]} scale={[0.06, 0.045, 0.045]} />
        <mesh geometry={GEO.ball} material={pillB} position={[-0.04, 0, 0]} scale={[0.06, 0.045, 0.045]} />
      </group>
    </>
  );
}
