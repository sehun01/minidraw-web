/* Original MiniDraw implementation. No Excalidraw code or dependencies. */
(() => {
  'use strict';
  const DEFAULT_STYLE = Object.freeze({strokeColor:'#1e1e1e',backgroundColor:'transparent',strokeWidth:2,strokeStyle:'solid',rounded:true,opacity:100});
  const clone = value => JSON.parse(JSON.stringify(value));
  function number(value, name, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
    return value;
  }
  function color(value, transparent = false) {
    if (transparent && value === 'transparent') return value;
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('색상은 #RRGGBB 형식이어야 합니다.');
    return value.toLowerCase();
  }
  function parse(text) {
    if (text.length > 10 * 1024 * 1024) throw new Error('파일 크기는 10MB 이하여야 합니다.');
    let raw;
    try { raw = JSON.parse(text); } catch { throw new Error('올바른 JSON 파일이 아닙니다.'); }
    const native = raw?.type === 'minidraw' && raw.version === 1;
    const external = raw?.type === 'excalidraw' && raw.version === 2;
    if (!native && !external) throw new Error('MiniDraw v1 또는 Excalidraw v2 장면 파일만 열 수 있습니다.');
    if (!Array.isArray(raw.elements) || raw.elements.length > 2000) throw new Error('도형 목록이 없거나 2,000개를 초과했습니다.');
    const ids = new Set();
    let simplified = false;
    const elements = raw.elements.filter(e => !e?.isDeleted).map(e => {
      if (!e || e.type !== 'rectangle') throw new Error('사각형만 포함한 파일을 열 수 있습니다. 현재 작업은 유지됩니다.');
      if (e.angle != null && e.angle !== 0) throw new Error('회전한 사각형은 지원하지 않습니다.');
      if (e.backgroundColor !== 'transparent' && e.fillStyle && e.fillStyle !== 'solid') throw new Error('단색 채우기 사각형만 지원합니다.');
      if (!['solid','dashed','dotted'].includes(e.strokeStyle ?? 'solid')) throw new Error('지원하지 않는 선 모양입니다.');
      if (typeof e.id !== 'string' || !e.id || e.id.length > 200 || ids.has(e.id)) throw new Error('도형 ID가 없거나 중복되었습니다.');
      ids.add(e.id);
      if (external && (e.roughness || e.groupIds?.length || e.locked || e.link)) simplified = true;
      return {
        id:e.id,type:'rectangle',
        x:number(e.x,'X 좌표',-1e6,1e6),y:number(e.y,'Y 좌표',-1e6,1e6),
        width:number(e.width,'너비',0.01,1e5),height:number(e.height,'높이',0.01,1e5),
        strokeColor:color(e.strokeColor ?? DEFAULT_STYLE.strokeColor),
        backgroundColor:color(e.backgroundColor ?? 'transparent',true),
        strokeWidth:number(e.strokeWidth ?? 2,'선 굵기',0.1,16),
        strokeStyle:e.strokeStyle ?? 'solid',
        rounded:native ? e.rounded === true : !!e.roundness,
        opacity:number(e.opacity ?? 100,'불투명도',0,100)
      };
    });
    return {scene:{elements,background:color(native ? raw.background ?? '#ffffff' : raw.appState?.viewBackgroundColor ?? '#ffffff')},simplified};
  }
  function serialize(scene) {
    return JSON.stringify({type:'minidraw',version:1,source:'MiniDraw',background:scene.background,elements:clone(scene.elements)},null,2);
  }
  function bounds(scene) {
    if (!scene.elements.length) return null;
    let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
    for (const e of scene.elements) { x=Math.min(x,e.x); y=Math.min(y,e.y); right=Math.max(right,e.x+e.width); bottom=Math.max(bottom,e.y+e.height); }
    return {x,y,width:right-x,height:bottom-y};
  }
  function radius(e) { return e.rounded ? Math.min(12,e.width/4,e.height/4) : 0; }
  function dash(e) { return e.strokeStyle === 'dashed' ? [e.strokeWidth*4,e.strokeWidth*3] : e.strokeStyle === 'dotted' ? [0,e.strokeWidth*3] : []; }
  function dimensions(scene, scale) {
    const box = bounds(scene);
    if (!box) throw new Error('먼저 사각형을 그려주세요.');
    if (![1,2,3].includes(scale)) throw new Error('지원하지 않는 이미지 배율입니다.');
    return {...box,pixelWidth:Math.ceil(box.width+20)*scale,pixelHeight:Math.ceil(box.height+20)*scale};
  }
  function renderPNG(scene, scale, includeBackground, canvas = document.createElement('canvas')) {
    const box = dimensions(scene,scale);
    if (box.pixelWidth > 16384 || box.pixelHeight > 16384 || box.pixelWidth*box.pixelHeight > 32e6) throw new Error('이미지가 너무 큽니다. 배율을 낮추거나 도형 간격을 줄여주세요.');
    canvas.width=box.pixelWidth; canvas.height=box.pixelHeight;
    const ctx=canvas.getContext('2d');
    if (!ctx) throw new Error('이 브라우저에서 PNG를 만들 수 없습니다.');
    if (includeBackground) {ctx.fillStyle=scene.background;ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.scale(scale,scale);ctx.translate(10-box.x,10-box.y);
    for (const e of scene.elements) {
      ctx.save();ctx.globalAlpha=e.opacity/100;ctx.lineWidth=e.strokeWidth;ctx.strokeStyle=e.strokeColor;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash(e));
      ctx.beginPath();ctx.roundRect(e.x,e.y,e.width,e.height,radius(e));
      if (e.backgroundColor !== 'transparent') {ctx.fillStyle=e.backgroundColor;ctx.fill();}
      ctx.stroke();ctx.restore();
    }
    return canvas;
  }
  window.MiniDrawScene = Object.freeze({DEFAULT_STYLE,clone,parse,serialize,bounds,radius,dash,dimensions,renderPNG});
})();
