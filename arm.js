'use strict';

const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d');
const phase = document.querySelector('#phase');
const play = document.querySelector('#play');
const controls = document.querySelector('#controls');
const targetAngle = document.querySelector('#target-angle');
const targetRadius = document.querySelector('#target-radius');
const angleValue = document.querySelector('#angle-value');
const radiusValue = document.querySelector('#radius-value');
const reachStatus = document.querySelector('#reach-status');
const initial = [-36, 26, 36, 44, 14, 100];
const names = ['Base rotation', 'Shoulder', 'Elbow', 'Upper joint', 'Wrist', 'Gripper'];
const limits = [[-180,180], [-85,85], [-110,110], [-110,110], [-90,90], [0,100]];
const radians = degrees => degrees * Math.PI / 180;
const degrees = radians => radians * 180 / Math.PI;
const linkLengths = [1.12, 1, .68];
const shoulderHeight = .59;
const jawLength = .34;
const pickupHeight = .25;
const liftHeight = .58;
const duration = 7.8;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const add = (a, b) => a.map((value, i) => value + b[i]);
const scale = (a, factor) => a.map(value => value * factor);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => scale(a, 1 / (Math.hypot(...a) || 1));
const up = [0,1,0];
const orange = [252,156,64], steel = [77,102,126], dark = [32,45,61], bright = [187,208,221], teal = [74,225,212];
let pose = [...initial];
let yaw = 0.83, elevation = 0.48, zoom = 1;
let animation = 0, playing = false, elapsed = 0, start = 0;
let manual = true;

const sliders = names.map((name, i) => {
  const row = document.createElement('div');
  row.className = 'control';
  row.innerHTML = '<label></label><output></output><input type="range">';
  const [label, output, input] = row.children;
  input.id = 'joint-' + i;
  label.htmlFor = input.id;
  label.textContent = name;
  output.htmlFor = input.id;
  [input.min, input.max] = limits[i];
  input.addEventListener('input', () => {
    manual = true;
    stop();
    pose[i] = Number(input.value);
    update();
  });
  controls.append(row);
  return {input, output};
});

function kinematics(values) {
  const [base, shoulder, elbow, upper, wrist] = values.map(radians);
  const hinge = [Math.cos(base),0,-Math.sin(base)];
  const forward = [Math.sin(base),0,Math.cos(base)];
  const angles = [shoulder, shoulder+elbow, shoulder+elbow+upper, shoulder+elbow+upper+wrist];
  const axes = angles.map(angle => add(scale(up,Math.cos(angle)),scale(forward,Math.sin(angle))));
  const points = [[0,shoulderHeight,0]];
  linkLengths.forEach((length,i) => points.push(add(points[i],scale(axes[i],length))));
  return {hinge, axes, points, tip:add(points[3],scale(axes[3],jawLength))};
}

function polarTarget(angle, radius, height) {
  return [radius * Math.sin(radians(angle)), height, radius * Math.cos(radians(angle))];
}

function solveTarget([x, y, z], gripper) {
  const [first, second, upper] = linkLengths;
  const radius = Math.hypot(x, z);
  // With the final link and jaws pointing down, solve for the endpoint of the elbow link.
  const height = y - shoulderHeight + upper + jawLength;
  const cosine = (radius ** 2 + height ** 2 - first ** 2 - second ** 2) / (2 * first * second);
  if (Math.abs(cosine) > 1 + 1e-9) return null;
  const elbow = Math.acos(clamp(cosine, -1, 1));
  const shoulder = Math.atan2(radius, height) -
    Math.atan2(second * Math.sin(elbow), first + second * Math.cos(elbow));
  const result = [
    degrees(Math.atan2(x, z)), degrees(shoulder), degrees(elbow),
    degrees(Math.PI - shoulder - elbow), 0, gripper
  ];
  return result.every((value, i) => value >= limits[i][0] && value <= limits[i][1]) ? result : null;
}

const destination = polarTarget(58, 1.55, pickupHeight);
let source;
let cycle;

function planTransfer() {
  const angle = Number(targetAngle.value);
  const radius = Number(targetRadius.value);
  source = polarTarget(angle, radius, pickupHeight);
  const pickup = solveTarget(source, 100);
  const lift = solveTarget([source[0], liftHeight, source[2]], 0);
  const aboveDrop = solveTarget([destination[0], liftHeight, destination[2]], 0);
  const drop = solveTarget(destination, 0);
  angleValue.textContent = angle + '°';
  radiusValue.textContent = radius.toFixed(2) + ' u';
  play.disabled = !pickup || !lift || !aboveDrop || !drop;
  reachStatus.textContent = !pickup ? 'Payload is outside the reachable area.' :
    !lift ? 'Move the payload closer to clear the pickup station.' : 'Payload is within transfer range.';
  reachStatus.classList.toggle('unreachable', play.disabled);
  cycle = play.disabled ? null : [
    [0,initial], [1.2,pickup], [1.85,[...pickup.slice(0,5),0]], [3.05,lift],
    [4.7,aboveDrop], [5.8,drop], [6.35,[...drop.slice(0,5),100]], [duration,[58,26,36,44,14,100]]
  ];
}

for (const control of [targetAngle, targetRadius]) {
  control.addEventListener('input', () => {
    manual = true;
    stop();
    elapsed = 0;
    pose = [...initial];
    planTransfer();
    update();
  });
}

function setTime(time) {
  elapsed = clamp(time,0,duration);
  const next = cycle.findIndex(([t]) => t >= elapsed);
  const [fromTime, from] = cycle[Math.max(0,next-1)];
  const [toTime, to] = cycle[next];
  const ratio = toTime === fromTime ? 0 : (elapsed-fromTime)/(toTime-fromTime);
  const ease = ratio*ratio*(3-2*ratio);
  pose = from.map((value,i) => value+(to[i]-value)*ease);
  update();
}

function update() {
  sliders.forEach(({input,output},i) => {
    const value = Math.round(pose[i]);
    input.value = value;
    output.textContent = value + (i === 5 ? '%' : '°');
  });
  const label = manual ? 'Manual control' : elapsed < 1.2 ? 'Approach' :
    elapsed < 1.85 ? 'Close gripper' : elapsed < 5.8 ? 'Transfer payload' :
    elapsed < 6.35 ? 'Release payload' : elapsed < duration ? 'Retract' : 'Cycle complete';
  if (phase.textContent !== label) phase.textContent = label;
  render();
}

function stop() {
  cancelAnimationFrame(animation);
  playing = false;
  play.textContent = !manual && elapsed > 0 && elapsed < duration ? 'Resume cycle' : 'Run IK transfer';
}

play.addEventListener('click', () => {
  if (playing) {
    stop();
    return;
  }
  if (manual || elapsed >= duration) elapsed = 0;
  manual = false;
  playing = true;
  play.textContent = 'Pause cycle';
  start = performance.now() - elapsed*1000;
  function tick(now) {
    setTime((now-start)/1000);
    if (elapsed < duration) animation = requestAnimationFrame(tick);
    else stop();
  }
  animation = requestAnimationFrame(tick);
});

document.querySelector('#reset').addEventListener('click', () => {
  manual = true;
  stop();
  elapsed = 0;
  pose = [...initial];
  targetAngle.value = targetAngle.defaultValue;
  targetRadius.value = targetRadius.defaultValue;
  planTransfer();
  yaw = .83; elevation = .48; zoom = 1;
  update();
});

let pointer;
canvas.addEventListener('pointerdown', event => {
  pointer = [event.clientX,event.clientY];
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!pointer) return;
  yaw -= (event.clientX-pointer[0])*.008;
  elevation = clamp(elevation+(event.clientY-pointer[1])*.008,.12,1.38);
  pointer = [event.clientX,event.clientY];
  render();
});
canvas.addEventListener('lostpointercapture', () => {pointer = undefined;});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = clamp(zoom*Math.exp(-event.deltaY*.001),.65,1.6);
  render();
},{passive:false});
canvas.addEventListener('keydown', event => {
  const moves = {ArrowLeft:[-.12,0], ArrowRight:[.12,0], ArrowUp:[0,.1], ArrowDown:[0,-.1]};
  if (!moves[event.key]) return;
  event.preventDefault();
  const [horizontal,vertical] = moves[event.key];
  yaw += horizontal;
  elevation = clamp(elevation+vertical,.12,1.38);
  render();
});

function render() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const density = Math.min(devicePixelRatio,2);
  if (canvas.width !== Math.round(width*density) || canvas.height !== Math.round(height*density)) {
    canvas.width = Math.round(width*density);
    canvas.height = Math.round(height*density);
  }
  ctx.setTransform(density,0,0,density,0,0);
  const gradient = ctx.createRadialGradient(width*.50,height*.42,0,width*.50,height*.42,width*.64);
  gradient.addColorStop(0,'#25394b');
  gradient.addColorStop(1,'#101820');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,width,height);

  const camera = [Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)];
  const right = unit(cross(up,camera)), vertical = cross(camera,right);
  const target = [0,1.19,0];
  const size = Math.min(width/6.1,height/4.25)*zoom;
  const project = point => {
    const relative = add(point,scale(target,-1));
    const factor = size*9/(9-dot(relative,camera));
    return [width/2+dot(relative,right)*factor,height*.49-dot(relative,vertical)*factor];
  };
  function path(points) {
    ctx.beginPath();
    points.forEach((point,i) => {
      const [x,y] = project(point);
      if (i) ctx.lineTo(x,y);
      else ctx.moveTo(x,y);
    });
  }
  for (let i=-10;i<=10;i++) {
    const n = i*.5;
    ctx.strokeStyle = i === 0 ? '#426174' : '#2d4557';
    path([[n,0,-5],[n,0,5]]); ctx.stroke();
    path([[-5,0,n],[5,0,n]]); ctx.stroke();
  }
  function ring(x,y,z,radius) {
    return Array.from({length:48},(_,i) => {
      const a = i*Math.PI/24;
      return [x+radius*Math.cos(a),y,z+radius*Math.sin(a)];
    });
  }
  ctx.strokeStyle = '#557486';
  path(ring(0,.012,0,2.42)); ctx.closePath(); ctx.stroke();

  const faces = [];
  const light = unit([-.45,.95,.66]);
  function face(points, color, normal) {
    if (dot(normal,camera) < -.01) return;
    const shade = .37 + .63*Math.max(0,dot(normal,light));
    const depth = points.reduce((sum,point) => sum+dot(point,camera),0)/points.length;
    faces.push({points,depth,color:'rgb('+color.map(value => Math.round(value*shade)).join(',')+')'});
  }
  function cylinder(a,b,radius,color) {
    const axis = unit(add(b,scale(a,-1)));
    const u = unit(cross(axis,Math.abs(axis[1])>.8 ? [1,0,0] : up));
    const v = cross(axis,u);
    const sides = 24;
    const normals = Array.from({length:sides},(_,i) => {
      const theta = i*2*Math.PI/sides;
      return add(scale(u,Math.cos(theta)),scale(v,Math.sin(theta)));
    });
    const ends = [a,b].map(point => normals.map(normal => add(point,scale(normal,radius))));
    face(ends[0],color,scale(axis,-1));
    face(ends[1],color,axis);
    for (let i=0;i<sides;i++) {
      const j = (i+1)%sides;
      face([ends[0][i],ends[1][i],ends[1][j],ends[0][j]],color,unit(add(normals[i],normals[j])));
    }
  }
  function box(center,axes,dimensions,color) {
    const edges = axes.map((axis,i) => scale(axis,dimensions[i]/2));
    for (let i=0;i<3;i++) {
      const u = edges[(i+1)%3], v = edges[(i+2)%3];
      for (const sign of [-1,1]) {
        const origin = add(center,scale(edges[i],sign));
        face([add(add(origin,u),v),add(add(origin,u),scale(v,-1)),
          add(add(origin,scale(u,-1)),scale(v,-1)),add(add(origin,scale(u,-1)),v)],color,scale(axes[i],sign));
      }
    }
  }

  cylinder([0,.012,0],[0,.13,0],.78,dark);
  cylinder([0,.13,0],[0,.18,0],.71,steel);
  cylinder([0,.18,0],[0,.34,0],.56,orange);
  cylinder([0,.34,0],[0,.48,0],.45,dark);
  const {hinge,axes,points,tip} = kinematics(pose);
  const baseForward = cross(hinge,up);
  box([0,.46,0],[hinge,up,baseForward],[.62,.23,.52],orange);
  for (let i=0;i<3;i++) {
    const a = points[i], b = points[i+1], axis = axes[i];
    const across = cross(hinge,axis);
    const middle = scale(add(a,b),.5);
    const length = Math.hypot(...add(b,scale(a,-1)));
    const thickness = [.31,.26,.20][i];
    box(middle,[hinge,axis,across],[thickness,length-.08,thickness*.87],orange);
    box(add(middle,scale(across,thickness*.48)),[hinge,axis,across],[thickness*.57,length*.57,.055],dark);
    cylinder(add(a,scale(hinge,-thickness*.79)),add(a,scale(hinge,thickness*.79)),thickness*.75,steel);
    for (const side of [-1,1]) {
      const cap = add(a,scale(hinge,side*thickness*.78));
      cylinder(cap,add(cap,scale(hinge,side*.045)),thickness*.43,bright);
    }
  }
  const wrist = points[3], finger = axes[3], fingerAcross = cross(hinge,finger);
  cylinder(add(wrist,scale(finger,-.075)),add(wrist,scale(finger,.12)),.16,steel);
  box(add(wrist,scale(finger,.145)),[hinge,finger,fingerAcross],[.51,.12,.22],dark);
  for (const side of [-1,1]) {
    const offset = side*(.105+pose[5]*.001);
    const jaw = add(add(wrist,scale(finger,.27)),scale(hinge,offset));
    box(jaw,[hinge,finger,fingerAcross],[.075,.24,.13],orange);
    box(add(jaw,scale(finger,.10)),[hinge,finger,fingerAcross],[.10,.07,.14],bright);
  }
  for (const [x,y,z] of [source,destination]) {
    cylinder([x,.01,z],[x,.055,z],.38,dark);
    cylinder([x,.055,z],[x,.075,z],.32,steel);
    cylinder([x,.075,z],[x,y-.09,z],.23,dark);
  }
  if (manual) {
    ctx.strokeStyle = play.disabled ? '#ff9b81' : '#74e1d4';
    path(ring(source[0], .014, source[2], .45));
    ctx.closePath();
    ctx.stroke();
  }
  const payload = manual || elapsed < 1.85 ? source : elapsed < 5.8 ? tip : destination;
  const carrying = !manual && elapsed >= 1.85 && elapsed < 5.8;
  box(payload,carrying ? [hinge,scale(finger,-1),fingerAcross] : [[1,0,0],up,[0,0,1]],[.18,.18,.18],teal);
  faces.sort((a,b) => a.depth-b.depth);
  for (const {points,color} of faces) {
    path(points); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = .6; ctx.stroke();
  }
  ctx.lineWidth = 1;
}

planTransfer();
new ResizeObserver(render).observe(canvas);
update();
